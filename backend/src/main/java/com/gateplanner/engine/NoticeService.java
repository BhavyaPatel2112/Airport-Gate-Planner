package com.gateplanner.engine;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.algo.text.SuffixTree;
import com.gateplanner.model.Closure;
import com.gateplanner.model.EventType;
import com.gateplanner.model.Notice;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Turnaround;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Validates, previews, applies and withdraws notices on a plan. Preview uses the stand interval
 * trees to list exactly which visits a closure would hit, without changing anything.
 */
@Service
public class NoticeService {

    private final PlanService plans;

    public NoticeService(PlanService plans) {
        this.plans = plans;
    }

    /** Validate only, preview, or apply a notice. */
    public synchronized Map<String, Object> submit(String planId, String text, String mode) {
        PlanState plan = plans.get(planId);
        NoticeEngine engine = plans.noticeEngine();
        String id = nextId(plan);
        Notice n = engine.parse(id, text);
        TraceRecorder trace = new TraceRecorder();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("notice", n);
        List<Closure> closures = NoticeEngine.closuresOf(n);
        out.put("affected", affected(plan, closures));
        List<Notice> all = new ArrayList<>(plan.getNotices());
        all.add(n);
        NoticeEngine.Index idx = engine.index(all);
        Map<String, List<String>> mentions = engine.mentions(idx, plans.standIds(), trace);
        out.put("mentions", mentions);
        snapshotSearch(plan, engine, idx, n);
        if ("apply".equalsIgnoreCase(mode)) {
            plan.getNotices().add(n);
            PlanService.Operation op = plans.applyClosures(plan, closures, trace, "Notice " + id);
            out.put("applied", true);
            out.put("operation", op);
        } else {
            out.put("applied", false);
            out.put("trace", trace.entries());
        }
        return out;
    }

    /** Withdraws a notice: its stands reopen and waiting visits are retried. */
    public synchronized PlanService.Operation withdraw(String planId, String noticeId) {
        PlanState plan = plans.get(planId);
        Notice found = null;
        for (Notice n : plan.getNotices()) {
            if (n.id().equals(noticeId)) {
                found = n;
            }
        }
        if (found == null) {
            throw new NotFoundException("Notice " + noticeId + " not found");
        }
        plan.getNotices().remove(found);
        plan.getClosures().removeIf(c -> c.noticeId().equals(noticeId));
        TraceRecorder trace = new TraceRecorder();
        List<PlanEvent> events = new ArrayList<>();
        for (String s : found.standIds()) {
            events.add(new PlanEvent(null, EventType.OPEN_STAND, s, null, found.from(), "Notice " + noticeId + " withdrawn"));
        }
        RecoveryEngine.Outcome o = RecoveryEngine.recover(plan, List.of(), List.of(), List.of(), true, trace,
                "notice withdrawn");
        events.addAll(o.events());
        plans.finish(plan, events, trace, o, found.standIds().isEmpty() ? null : found.standIds().get(0));
        return new PlanService.Operation(plan, events, trace, "Notice " + noticeId + " withdrawn"
                + (o.placed() > 0 ? ", " + o.placed() + " waiting visits placed" : ""));
    }

    /** Suffix tree search over a plan's notices. */
    public NoticeEngine.SearchOutcome search(String planId, String query) {
        PlanState plan = plans.get(planId);
        NoticeEngine engine = plans.noticeEngine();
        NoticeEngine.Index idx = engine.index(plan.getNotices());
        NoticeEngine.SearchOutcome r = engine.search(idx, query);
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("pattern", r.query());
        snap.put("path", r.path());
        snap.put("hits", r.hits().size());
        snap.put("textLength", r.textLength());
        snap.put("nodes", r.treeNodes());
        snap.put("suffixTreeMs", r.suffixTreeMs());
        snap.put("kmpMs", r.kmpMs());
        plan.getLastSnapshots().put("suffix", snap);
        return r;
    }

    private void snapshotSearch(PlanState plan, NoticeEngine engine, NoticeEngine.Index idx, Notice n) {
        String pattern = n.standIds().isEmpty() ? n.kind() : " " + n.standIds().get(0) + " ";
        SuffixTree.SearchResult r = idx.tree().find(pattern);
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("pattern", pattern.trim());
        snap.put("path", r.path());
        snap.put("hits", r.positions().size());
        snap.put("textLength", idx.text().length());
        snap.put("nodes", idx.tree().nodeCount());
        plan.getLastSnapshots().put("suffix", snap);
    }

    private List<Map<String, Object>> affected(PlanState plan, List<Closure> closures) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Closure c : closures) {
            if (plan.tree(c.standId()) == null) {
                continue;
            }
            for (RedBlackIntervalTree.Node<String> h : plan.tree(c.standId()).overlaps(c.from(), c.to())) {
                Turnaround t = plan.visit(h.value());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("visit", t.getId());
                row.put("label", t.getLabel());
                row.put("stand", c.standId());
                row.put("start", Clock.hhmm(t.getStart()));
                row.put("end", Clock.hhmm(t.getOccupiedEnd()));
                out.add(row);
            }
        }
        return out;
    }

    private static String nextId(PlanState plan) {
        int max = 0;
        for (Notice n : plan.getNotices()) {
            try {
                max = Math.max(max, Integer.parseInt(n.id().substring(1)));
            } catch (NumberFormatException ignored) {
                // custom ids are skipped
            }
        }
        return String.format("N%02d", max + 1);
    }
}
