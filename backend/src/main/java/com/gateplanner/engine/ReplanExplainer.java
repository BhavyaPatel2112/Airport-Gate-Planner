package com.gateplanner.engine;

import com.gateplanner.algo.interval.RedBlackIntervalTree;
import com.gateplanner.model.EventType;
import com.gateplanner.model.PlanEvent;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;
import com.gateplanner.model.StandClass;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns one "fix everything" re-plan into a short guided replay. Each step shows a different
 * algorithm at work on a real flight of this plan, with the numbers the Java code measured:
 *
 * <ol>
 *   <li><b>collect</b>: counting sort and the cut into conflict windows,</li>
 *   <li><b>path</b>: one rescued flight as an alternating (augmenting) path against the old plan,</li>
 *   <li><b>edges</b>: the interval tree queries that built one flight's edges,</li>
 *   <li><b>window</b>: one window as a flow network, Edmonds-Karp against greedy on the same graph,</li>
 *   <li><b>cut</b>: a minimum cut that proves some flights cannot be matched (Hall's theorem),</li>
 *   <li><b>hold</b>: one of those flights held in 5 minute steps until a stand frees,</li>
 *   <li><b>summary</b>: totals, and greedy first-fit run on a copy of the same plan.</li>
 * </ol>
 *
 * <p>Steps whose situation did not occur are left out, so no step repeats another. The result is
 * plain data (text, numbers, stand and flight ids); the browser only draws it.</p>
 */
final class ReplanExplainer {

    /** One flight that waited for a stand after the re-plan. */
    record Hold(String visit, int due, int waited, int checks, int compatible, String stand, String whyStranded) {
    }

    /** Everything the re-plan measured. {@code previous} holds the old stand of every lifted visit that had one. */
    record Input(PlanState plan, int from, int before, int lifted, List<RecoveryEngine.WindowInfo> windows,
                 Map<String, String> previous, Set<String> stranded, List<PlanEvent> events, List<Hold> holds,
                 List<String> diverted, int matchingLeft, int greedyLeft, double sortMs, double totalMs,
                 int holdChecks, boolean matching) {
    }

    private ReplanExplainer() {
    }

    static Map<String, Object> explain(Input in) {
        PlanState plan = in.plan();
        Map<String, RecoveryEngine.WindowInfo> windowOf = new HashMap<>();
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            for (String v : w.visits()) {
                windowOf.put(v, w);
            }
        }
        Set<String> held = new HashSet<>();
        for (Hold h : in.holds()) {
            held.add(h.visit());
        }
        // every visit whose stand is different now, in the order the events list them
        List<String> changed = new ArrayList<>();
        for (PlanEvent e : in.events()) {
            if ((e.type() == EventType.MOVE || e.type() == EventType.ASSIGN) && !changed.contains(e.flight())) {
                changed.add(e.flight());
            }
        }
        Set<String> used = new HashSet<>();
        List<Map<String, Object>> steps = new ArrayList<>();
        steps.add(collect(in, changed));
        Map<String, Object> path = path(in, windowOf, held, used);
        if (path != null) {
            steps.add(path);
        }
        Map<String, Object> edges = edges(in, windowOf, held, used);
        if (edges != null) {
            steps.add(edges);
        }
        Map<String, Object> window = window(in, windowOf, held, changed, used);
        if (window != null) {
            steps.add(window);
        }
        Map<String, Object> cut = cut(in);
        if (cut != null) {
            steps.add(cut);
        }
        Map<String, Object> hold = hold(in, used);
        if (hold != null) {
            steps.add(hold);
        }
        steps.add(summary(in, changed, held));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", in.from());
        out.put("before", in.before());
        out.put("after", plan.unplacedVisits().size());
        out.put("steps", steps);
        return out;
    }

    // ---------------------------------------------------------------- steps

    private static Map<String, Object> collect(Input in, List<String> changed) {
        int stranded = in.stranded().size();
        int largest = 0;
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            largest = Math.max(largest, w.visits().size());
        }
        Map<String, Integer> due = new HashMap<>();
        for (Hold h : in.holds()) {
            due.put(h.visit(), h.due());
        }
        int earliest = Integer.MAX_VALUE;
        for (String v : in.stranded()) {
            Turnaround t = in.plan().visit(v);
            if (t != null && t.getArrival() != null) {
                earliest = Math.min(earliest, due.getOrDefault(v, t.getStart()));
            }
        }
        Map<String, Object> s = step("collect", "Unit 1 · Counting sort",
                stranded > 0 ? stranded + (stranded == 1 ? " flight had" : " flights had") + " no stand at " + Clock.hhmm(in.from())
                        : "Re-planning everything from " + Clock.hhmm(in.from()));
        text(s, "The planner lifted " + in.lifted() + " flights off the plan: the " + (in.lifted() - stranded)
                        + " visits that start at or after " + Clock.hhmm(in.from()) + (stranded > 0 ? " and the " + stranded
                        + " circling without a stand" : "") + ". Aircraft already parked before " + Clock.hhmm(in.from())
                        + " keep their stands, and every closure and delay stays in force.",
                "Counting sort put the " + in.lifted() + " flights in start-minute order in O(n + k) time, with n = "
                        + in.lifted() + " flights and k = " + PlanState.HORIZON + " possible minutes, without a single "
                        + "comparison (" + ms(in.sortMs()) + "). One pass then cut the list into " + in.windows().size()
                        + " conflict windows: a window closes as soon as the next flight starts after the earliest finish "
                        + "inside it. Every flight in a window is on the ground at one shared minute, so no two of them "
                        + "can share a stand, and each window can be solved on its own.");
        fact(s, in.lifted(), "flights lifted");
        fact(s, stranded, "had no stand");
        fact(s, in.windows().size(), "conflict windows");
        fact(s, largest, "in the largest window");
        brief(s, "Lift " + in.lifted() + " flights, sort them, split them into " + in.windows().size() + " windows",
                "Counting sort by start minute: O(n + k), " + ms(in.sortMs()) + ", zero comparisons",
                "A window is a set of flights on the ground at the same minute, so no two can share a stand",
                "Each window becomes one matching problem");
        s.put("minute", earliest == Integer.MAX_VALUE ? in.from() : earliest + 2);
        s.put("holding", stranded > 0);
        s.put("apply", List.of());
        // the camera looks at the holding pattern, where the stranded flights circle
        s.put("focus", stranded > 0 ? List.of() : changed.stream().map(v -> in.previous().get(v)).filter(x -> x != null).limit(30).toList());
        return s;
    }

    /** A stranded flight that got a stand some other flight held in the old plan: the alternating path. */
    private static Map<String, Object> path(Input in, Map<String, RecoveryEngine.WindowInfo> windowOf, Set<String> held,
                                            Set<String> used) {
        PlanState plan = in.plan();
        List<String> best = null;
        boolean bestNeeded = false;
        for (String f : in.stranded()) {
            if (held.contains(f) || plan.standOf(f) == null) {
                continue;
            }
            List<String> chain = new ArrayList<>();
            chain.add(f);
            String cur = f;
            Set<String> seen = new HashSet<>(List.of(f));
            while (true) {
                String stand = plan.standOf(cur);
                chain.add(stand);
                // at most three flights on the path, so the card stays readable
                String displaced = chain.size() >= 6 ? null : displacedFrom(in, stand, plan.visit(cur), seen);
                if (displaced == null) {
                    break;
                }
                chain.add(displaced);
                seen.add(displaced);
                cur = displaced;
            }
            if (chain.size() < 4) {
                continue;
            }
            String end = chain.get(chain.size() - 1);
            RecoveryEngine.WindowInfo w = windowOf.get(f);
            boolean needed = w != null && !w.options().getOrDefault(f, List.of()).contains(end);
            if (best == null || (needed && !bestNeeded) || (needed == bestNeeded && chain.size() > best.size())) {
                best = chain;
                bestNeeded = needed;
            }
        }
        if (best == null) {
            return null;
        }
        Turnaround f = plan.visit(best.get(0));
        String s1 = best.get(1);
        Turnaround g = plan.visit(best.get(2));
        String end = best.get(best.size() - 1);
        RecoveryEngine.WindowInfo w = windowOf.get(f.getId());
        Map<String, Object> s = step("path", "Unit 5 · Augmenting path", name(f) + " gets " + s1 + " by moving " + name(g));
        List<Map<String, Object>> nodes = new ArrayList<>();
        StringBuilder chainText = new StringBuilder();
        List<String> out = new ArrayList<>();
        List<String> into = new ArrayList<>();
        for (int i = 0; i < best.size(); i++) {
            boolean flight = i % 2 == 0;
            String id = best.get(i);
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("kind", flight ? "flight" : "stand");
            n.put("label", flight ? name(plan.visit(id)) : id);
            nodes.add(n);
            chainText.append(i == 0 ? "" : " → ").append(flight ? name(plan.visit(id)) : id);
            if (flight) {
                into.add(name(plan.visit(id)) + " on " + best.get(i + 1));
                if (i > 0) {
                    out.add(name(plan.visit(id)) + " on " + best.get(i - 1));
                }
            }
        }
        s.put("path", nodes);
        StringBuilder moves = new StringBuilder();
        for (int i = 2; i + 1 < best.size(); i += 2) {
            moves.append(" ").append(name(plan.visit(best.get(i)))).append(i == 2 ? "" : ", which held " + best.get(i - 1) + ",")
                    .append(" moved from ").append(best.get(i - 1)).append(" to ").append(best.get(i + 1)).append(".");
        }
        text(s, name(f) + " had no stand. In window " + (w == null ? "?" : w.index()) + " Edmonds-Karp gave it stand " + s1
                        + ", which " + name(g) + " held in the old plan." + moves,
                "Laid over the old plan, the change is one alternating path: " + chainText + ". " + words(out.size())
                        + (out.size() == 1 ? " old pair leaves" : " old pairs leave") + " the matching (" + String.join(", ", out)
                        + ") and " + words(into.size()).toLowerCase() + " new pairs join it (" + String.join(", ", into)
                        + "), so the same stands now hold one more flight. That is an augmenting path: Edmonds-Karp finds "
                        + "one by breadth-first search in the residual graph and flips it, and by Berge's theorem the "
                        + "matching is maximum once no such path is left.",
                needWhy(in, f, end, best)
                        + " Greedy first-fit never takes back a stand it has already given, so it cannot make this move.");
        fact(s, (best.size() - 1), "edges on the path");
        fact(s, best.size() / 2, "flights on the path");
        fact(s, "+1", "flight matched");
        List<String> apply = new ArrayList<>();
        for (int i = best.size() - 2; i >= 0; i -= 2) {
            apply.add(best.get(i));
        }
        s.put("apply", apply);
        s.put("sequence", true);
        List<String> focus = new ArrayList<>();
        List<List<String>> arcs = new ArrayList<>();
        List<Map<String, String>> marks = new ArrayList<>();
        for (int i = 1; i < best.size(); i += 2) {
            focus.add(best.get(i));
            marks.add(mark(best.get(i), "chosen"));
            if (i + 2 < best.size()) {
                arcs.add(List.of(best.get(i), best.get(i + 2)));
            }
        }
        s.put("focus", focus);
        s.put("arcs", arcs);
        s.put("marks", marks);
        int lo = f.getStart();
        for (int i = 2; i < best.size(); i += 2) {
            lo = Math.max(lo, plan.visit(best.get(i)).getStart());
        }
        brief(s, "One augmenting path: same stands, one more flight placed",
                "Before: " + String.join(" · ", out),
                "After: " + String.join(" · ", into),
                shortNeed(in, f, end, best),
                "Greedy never takes a stand back, so it cannot find this");
        s.put("minute", lo + 3);
        used.addAll(apply);
        return s;
    }

    /** Why the last stand on the path was no use to the first flight, or the honest tie when it was. */
    private static String needWhy(Input in, Turnaround f, String end, List<String> chain) {
        RecoveryEngine.WindowInfo w = null;
        for (RecoveryEngine.WindowInfo x : in.windows()) {
            if (x.visits().contains(f.getId())) {
                w = x;
            }
        }
        boolean could = w != null && w.options().getOrDefault(f.getId(), List.of()).contains(end);
        if (could) {
            return name(f) + " could also have used " + end + " directly: matching maximises how many flights get a stand, "
                    + "not how few move, and the search reached " + chain.get(1) + " first.";
        }
        Stand s = in.plan().stand(end);
        if (s != null && !s.canHost(f)) {
            return name(f) + " could not use " + end + " itself: it is not a " + StandClass.of(f).label() + " stand.";
        }
        Turnaround blocker = firstOverlap(in.plan(), end, f.getStart(), f.getOccupiedEnd(), new HashSet<>(chain));
        if (blocker != null) {
            return name(f) + " could not use " + end + " itself: " + name(blocker) + " is there from "
                    + Clock.hhmm(blocker.getStart()) + " to " + Clock.hhmm(blocker.getOccupiedEnd()) + ", which overlaps "
                    + name(f) + "'s " + Clock.hhmm(f.getStart()) + " to " + Clock.hhmm(f.getOccupiedEnd()) + ".";
        }
        return name(f) + " could not use " + end + " itself at its times, so a direct move was impossible.";
    }

    /** The lifted visit that held {@code stand} in the old plan at a time that overlaps {@code t}, and moved away. */
    private static String displacedFrom(Input in, String stand, Turnaround t, Set<String> seen) {
        for (Map.Entry<String, String> e : in.previous().entrySet()) {
            if (!stand.equals(e.getValue()) || seen.contains(e.getKey())) {
                continue;
            }
            Turnaround g = in.plan().visit(e.getKey());
            String now = in.plan().standOf(e.getKey());
            if (g != null && now != null && !now.equals(stand) && g.overlaps(t.getStart(), t.getOccupiedEnd())) {
                return e.getKey();
            }
        }
        return null;
    }

    /** The flight with the fewest free stands: how its edges came out of the interval trees. */
    private static Map<String, Object> edges(Input in, Map<String, RecoveryEngine.WindowInfo> windowOf, Set<String> held,
                                             Set<String> used) {
        PlanState plan = in.plan();
        Turnaround f = null;
        int fewest = Integer.MAX_VALUE;
        for (String v : in.stranded()) {
            RecoveryEngine.WindowInfo w = windowOf.get(v);
            if (w == null || held.contains(v) || used.contains(v) || plan.standOf(v) == null) {
                continue;
            }
            int n = w.options().getOrDefault(v, List.of()).size();
            if (n > 0 && n < fewest) {
                fewest = n;
                f = plan.visit(v);
            }
        }
        if (f == null) {
            return null;
        }
        RecoveryEngine.WindowInfo w = windowOf.get(f.getId());
        List<String> free = w.options().get(f.getId());
        Set<String> windowVisits = new HashSet<>(w.visits());
        String chosen = plan.standOf(f.getId());
        int compatible = 0;
        int closed = 0;
        int busy = 0;
        String example = null;
        List<Map<String, String>> marks = new ArrayList<>();
        for (Stand st : plan.getStands()) {
            if (!st.canHost(f)) {
                continue;
            }
            compatible++;
            String tone;
            if (!plan.openDuring(st.getId(), f.getStart(), f.getOccupiedEnd())) {
                closed++;
                tone = "closed";
            } else if (free.contains(st.getId())) {
                tone = st.getId().equals(chosen) ? "chosen" : "free";
            } else {
                busy++;
                tone = "busy";
                if (example == null) {
                    Turnaround o = firstOverlap(plan, st.getId(), f.getStart(), f.getOccupiedEnd(), windowVisits);
                    if (o != null) {
                        example = st.getId() + " has " + name(o) + " until " + Clock.hhmm(o.getOccupiedEnd());
                    }
                }
            }
            if (marks.size() < 60) {
                marks.add(mark(st.getId(), tone));
            }
        }
        Stand cs = plan.stand(chosen);
        boolean contactFree = false;
        for (String id : free) {
            contactFree |= plan.stand(id).isContact();
        }
        Map<String, Object> s = step("edges", "Unit 3 · Red-black interval tree",
                name(f) + ": " + free.size() + " free " + (free.size() == 1 ? "stand" : "stands") + " out of " + compatible);
        Map<String, Object> ba = new LinkedHashMap<>();
        ba.put("before", "No stand");
        ba.put("beforeSub", "due " + Clock.hhmm(f.getStart()));
        ba.put("after", "Stand " + chosen);
        ba.put("afterSub", Clock.hhmm(f.getStart()) + " to " + Clock.hhmm(f.getOccupiedEnd()));
        s.put("ba", ba);
        text(s, name(f) + " is a " + StandClass.of(f).label() + " flight. It needs a stand from " + Clock.hhmm(f.getStart())
                        + " to " + Clock.hhmm(f.getOccupiedEnd()) + ", its turnaround plus a " + f.getBuffer()
                        + " minute safety gap. Only " + compatible + " of the " + plan.getStands().size()
                        + " stands can take that class: same terminal, same domestic or international side, and big enough.",
                "For each of those " + compatible + " stands the planner asked the stand's red-black interval tree for any "
                        + "visit overlapping [" + Clock.hhmm(f.getStart()) + ", " + Clock.hhmm(f.getOccupiedEnd()) + "). "
                        + "A query costs O(log n + k): it follows one path down and skips every subtree whose largest end "
                        + "time is before " + Clock.hhmm(f.getStart()) + ". " + closed + " stands were closed by a notice, "
                        + busy + " were busy" + (example == null ? "" : " (" + example + ")") + ", and " + free.size()
                        + (free.size() == 1 ? " was free. That one free stand became its only edge" : " were free. Each free "
                        + "stand became one edge") + " in the bipartite graph.",
                "Few edges make it the hardest flight of window " + w.index() + " to place, yet the matching still found "
                        + "it a stand: " + chosen + (cs.isContact() ? ", with a jet bridge." : contactFree
                        ? ", a remote stand, because the free jet-bridge stands were needed by other flights in the window."
                        : ", a remote stand, because no jet-bridge stand of its class was free."));
        fact(s, compatible, "compatible stands");
        fact(s, closed, "closed");
        fact(s, busy, "busy");
        fact(s, free.size(), free.size() == 1 ? "edge" : "edges");
        s.put("marks", marks);
        s.put("apply", List.of(f.getId()));
        List<String> focus = new ArrayList<>(free);
        if (focus.size() < 3) {
            for (Map<String, String> m : marks) {
                if (focus.size() >= 8) {
                    break;
                }
                if (!focus.contains(m.get("stand"))) {
                    focus.add(m.get("stand"));
                }
            }
        }
        s.put("focus", focus.subList(0, Math.min(14, focus.size())));
        brief(s, "Interval trees cut " + compatible + " possible stands down to " + free.size()
                        + (free.size() == 1 ? " edge" : " edges"),
                "Needs " + Clock.hhmm(f.getStart()) + " to " + Clock.hhmm(f.getOccupiedEnd()) + ", including a " + f.getBuffer()
                        + " min safety gap",
                "One O(log n + k) tree query per stand: " + closed + " closed · " + busy + " busy · " + free.size() + " free",
                "Fewest edges in window " + w.index() + ", still placed: stand " + chosen
                        + (cs.isContact() ? " (jet bridge)" : " (remote)"));
        s.put("minute", f.getStart() + 3);
        used.add(f.getId());
        return s;
    }

    /** The window with the most changes, as a flow network, against greedy on the same graph. */
    private static Map<String, Object> window(Input in, Map<String, RecoveryEngine.WindowInfo> windowOf, Set<String> held,
                                              List<String> changed, Set<String> used) {
        RecoveryEngine.WindowInfo best = null;
        int bestScore = 0;
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            int score = 0;
            for (String v : w.visits()) {
                if (changed.contains(v) && !held.contains(v)) {
                    score++;
                }
            }
            score += (w.matched() - w.greedyMatched()) * 50;
            if (score > bestScore) {
                bestScore = score;
                best = w;
            }
        }
        if (best == null) {
            return null;
        }
        RecoveryEngine.WindowInfo w = best;
        int g = w.visits().size();
        PlanState plan = in.plan();
        List<String> apply = new ArrayList<>();
        List<List<String>> arcs = new ArrayList<>();
        List<String> focus = new ArrayList<>();
        int rescued = 0;
        int moved = 0;
        for (String v : w.visits()) {
            if (!changed.contains(v) || held.contains(v)) {
                continue;
            }
            apply.add(v);
            String now = plan.standOf(v);
            String old = in.previous().get(v);
            if (old == null) {
                rescued++;
            } else {
                moved++;
                if (arcs.size() < 24) {
                    arcs.add(List.of(old, now));
                }
            }
            if (now != null && focus.size() < 40) {
                focus.add(now);
            }
        }
        Map<String, Object> s = step("window", "Unit 5 · Maximum matching (Edmonds-Karp)",
                "Window " + w.index() + ": " + g + " flights matched at once");
        String greedyLine = in.matching()
                ? "Greedy first-fit on the exact same graph, giving each flight in turn its first free stand, places "
                        + w.greedyMatched() + " of " + g + "." + (w.greedyMatched() < w.matched()
                        ? " Matching places " + (w.matched() - w.greedyMatched()) + " more with the same stands."
                        : " Here greedy happens to reach the same count, but only the matching can prove no better answer exists.")
                : "This plan uses greedy first-fit, so each flight simply takes its first free stand in order.";
        text(s, "Window " + w.index() + " holds " + g + " flights that are all on the ground at " + Clock.hhmm(w.sharedMinute())
                        + ". The planner built a bipartite graph: these flights on the left, the " + w.stands()
                        + " stands free for at least one of them on the right, and " + w.edges() + " edges, one per free "
                        + "flight and stand pair found by the interval trees.",
                "Edmonds-Karp turns it into a flow network: source to every flight, flight to each of its free stands, "
                        + "stand to sink, every capacity 1. Each breadth-first search finds a shortest augmenting path and "
                        + "pushes one unit of flow: " + w.augmentations() + " searches matched " + w.matched() + " of " + g
                        + " in " + ms(w.ms()) + ". When no augmenting path is left the flow is maximum (max-flow min-cut "
                        + "theorem), so no other assignment of these stands places more of these flights.",
                greedyLine + " In this window " + rescued + " stranded " + (rescued == 1 ? "flight gets" : "flights get")
                        + " a stand and " + moved + " parked " + (moved == 1 ? "flight shifts" : "flights shift") + " to make room.");
        fact(s, g, "flights");
        fact(s, w.stands(), "stands");
        fact(s, w.edges(), "edges");
        fact(s, w.augmentations(), "augmenting paths");
        if (in.matching()) {
            fact(s, w.greedyMatched() + " / " + g, "greedy on this graph");
        }
        s.put("apply", apply);
        s.put("arcs", arcs);
        s.put("focus", focus);
        brief(s, "Edmonds-Karp matched " + w.matched() + " of " + g + " flights in one go",
                "Flow network: source → " + g + " flights → " + w.stands() + " stands → sink, " + w.edges() + " edges",
                w.augmentations() + " breadth-first augmenting paths in " + ms(w.ms()) + "; none left means maximum",
                in.matching() ? "Greedy on the same graph: " + w.greedyMatched() + " of " + g
                        + (w.greedyMatched() < w.matched() ? ", so matching places " + (w.matched() - w.greedyMatched()) + " more" : "")
                        : "This plan repairs with greedy first-fit");
        s.put("minute", w.sharedMinute() + 1);
        used.addAll(apply);
        return s;
    }

    /** The window where the matching fell short, with the Hall violator the minimum cut found. */
    private static Map<String, Object> cut(Input in) {
        RecoveryEngine.WindowInfo best = null;
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            if (!w.cutVisits().isEmpty() && (best == null || w.cutVisits().size() > best.cutVisits().size())) {
                best = w;
            }
        }
        if (best == null) {
            return null;
        }
        RecoveryEngine.WindowInfo w = best;
        int sz = w.cutVisits().size();
        int ns = w.cutStands().size();
        int short_ = w.visits().size() - w.matched();
        Turnaround first = in.plan().visit(w.cutVisits().get(0));
        String cls = first == null ? "" : StandClass.of(first).label() + " ";
        Map<String, Object> s = step("cut", "Unit 5 · Minimum cut (Hall's theorem)",
                short_ + (short_ == 1 ? " flight" : " flights") + " no matching can place");
        text(s, "In window " + w.index() + " at " + Clock.hhmm(w.sharedMinute()) + ", " + short_
                        + (short_ == 1 ? " flight was" : " flights were") + " still without a stand after the last augmenting "
                        + "path. To prove that is not a weakness of the search, the planner runs one more breadth-first search "
                        + "from the source in the residual graph, in O(V + E).",
                "The flights it reaches form a set S of " + sz + " " + cls + "flights, and the stands it reaches form N(S): the "
                        + "only " + ns + " stands any of them can use. By Hall's theorem every flight in S can be placed only "
                        + "if |N(S)| ≥ |S|. Here " + sz + " > " + ns + ", so at least " + (sz - ns) + " of them cannot get a "
                        + "stand from any algorithm. The cut's capacity equals the matching size, which also certifies that "
                        + "the matching is maximum.",
                "The ringed stands are N(S). The flights left over go to the holding step next.");
        fact(s, sz, "flights in S");
        fact(s, ns, "stands in N(S)");
        fact(s, sz - ns, "short, proven");
        List<Map<String, String>> marks = new ArrayList<>();
        for (String id : w.cutStands()) {
            marks.add(mark(id, "cut"));
        }
        s.put("marks", marks);
        s.put("focus", w.cutStands().subList(0, Math.min(20, ns)));
        s.put("holding", true);
        s.put("apply", List.of());
        brief(s, "Proof that " + short_ + (short_ == 1 ? " flight cannot" : " flights cannot") + " fit, whatever the algorithm",
                "Residual breadth-first search: " + sz + " flights (S) share only " + ns + " stands (N(S))",
                "Hall's theorem: |S| > |N(S)|, so at least " + (sz - ns) + " must stay unplaced",
                "Cut capacity equals matching size: the matching is provably maximum");
        s.put("minute", w.sharedMinute() + 1);
        return s;
    }

    /** The flight held longest: the time-stepped interval tree search, and the departure that freed its stand. */
    private static Map<String, Object> hold(Input in, Set<String> used) {
        Hold h = null;
        for (Hold x : in.holds()) {
            if (h == null || x.waited() > h.waited()) {
                h = x;
            }
        }
        if (h == null) {
            return null;
        }
        PlanState plan = in.plan();
        Turnaround f = plan.visit(h.visit());
        Turnaround leaver = null;
        RedBlackIntervalTree<String> tree = plan.tree(h.stand());
        for (RedBlackIntervalTree.Node<String> n : tree.inOrder()) {
            Turnaround o = plan.visit(n.value());
            if (o != f && o.getOccupiedEnd() <= f.getStart() && (leaver == null || o.getOccupiedEnd() > leaver.getOccupiedEnd())) {
                leaver = o;
            }
        }
        Map<String, Object> s = step("hold", "Unit 3 · Interval tree search over time",
                name(f) + " holds " + h.waited() + " min for stand " + h.stand());
        Map<String, Object> ba = new LinkedHashMap<>();
        ba.put("before", "No stand");
        ba.put("beforeSub", "due " + Clock.hhmm(h.due()));
        ba.put("after", "Stand " + h.stand());
        ba.put("afterSub", "from " + Clock.hhmm(f.getStart()) + ", " + h.waited() + " min later");
        ba.put("bad", true);
        s.put("ba", ba);
        String freed = leaver == null ? "it is empty from " + Clock.hhmm(f.getStart())
                : name(leaver) + " leaves it at " + Clock.hhmm(leaver.getEnd()) + " and its " + leaver.getBuffer()
                        + " minute safety gap ends at " + Clock.hhmm(leaver.getOccupiedEnd());
        String why = h.whyStranded() == null ? "" : " " + h.whyStranded();
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            if (w.cutVisits().contains(f.getId())) {
                why = " It is one of the " + w.cutVisits().size() + " flights in S that the minimum cut proved cannot all fit.";
            }
        }
        text(s, "Even after matching, " + name(f) + " had no stand when it was due at " + Clock.hhmm(h.due()) + "." + why,
                "Rather than divert it, the planner slides its whole visit later in 5 minute steps. At every step it asks "
                        + "the interval tree of each of its " + h.compatible() + " compatible stands whether the shifted "
                        + "interval is empty: " + h.checks() + " queries in all, each O(log n + k). The first yes comes at +"
                        + h.waited() + " min on stand " + h.stand() + ": " + freed + ".",
                "Holding costs this one flight " + h.waited() + " minutes in the air or at its origin, and no other flight "
                        + "has to move for it. Watch the clock run: the stand empties, then " + name(f) + " lands and taxis in.");
        fact(s, h.waited() + " min", "held");
        fact(s, h.waited() / 5, "time steps tried");
        fact(s, h.checks(), "tree queries");
        fact(s, h.compatible(), "compatible stands");
        s.put("apply", List.of(f.getId()));
        s.put("holdUntil", f.getStart() - 13);
        brief(s, name(f) + " waits " + h.waited() + " min instead of diverting",
                "Slide the visit later in 5 min steps: " + h.waited() / 5 + " steps, " + h.checks() + " tree queries",
                "First fit: stand " + h.stand() + (leaver == null ? "" : ", once " + name(leaver) + " leaves at "
                        + Clock.hhmm(leaver.getEnd()) + " and the gap ends at " + Clock.hhmm(leaver.getOccupiedEnd())),
                "No other flight has to move");
        s.put("minute", h.due());
        s.put("run", List.of(h.due(), f.getStart() + 7));
        s.put("focus", List.of(h.stand()));
        s.put("marks", List.of(mark(h.stand(), "chosen")));
        used.add(f.getId());
        return s;
    }

    private static Map<String, Object> summary(Input in, List<String> changed, Set<String> held) {
        int after = in.plan().unplacedVisits().size();
        int rescued = 0;
        int moved = 0;
        for (String v : changed) {
            if (in.previous().get(v) == null) {
                rescued++;
            } else {
                moved++;
            }
        }
        int edges = 0;
        int aug = 0;
        for (RecoveryEngine.WindowInfo w : in.windows()) {
            edges += w.edges();
            aug += w.augmentations();
        }
        int waits = 0;
        for (Hold h : in.holds()) {
            waits += h.waited();
        }
        Map<String, Object> s = step("summary", "Result",
                after == 0 ? "Every flight has a stand again" : after + (after == 1 ? " flight would divert" : " flights would divert"));
        fact(s, in.before(), "without a stand before");
        fact(s, after, "without a stand now");
        fact(s, rescued - held.size(), "placed by the matching");
        fact(s, held.size(), "held" + (held.isEmpty() ? "" : ", " + waits / held.size() + " min on average"));
        fact(s, moved, "moved to make room");
        int gl = in.greedyLeft();
        int ml = in.matchingLeft();
        String head = "As a check, the same re-plan also ran on a copy of this plan with greedy first-fit: " + gl
                + (gl == 1 ? " flight" : " flights") + " left without a stand before holding, against " + ml
                + " with maximum matching. ";
        String compare = !in.matching()
                ? "This plan uses greedy first-fit; switch the repair method to matching in the Scenario lab to compare."
                : gl > ml ? head + "Matching saves " + (gl - ml) + (gl - ml == 1 ? " flight" : " flights") + " from holding."
                : gl == ml ? head + "The same count here, but only the matching comes with a proof (the minimum cut) that "
                        + "no assignment inside a window could do better."
                : head + "Greedy did better across the whole evening. Each window is matched optimally on its own, but the "
                        + "windows are solved one after another, so a choice that is best inside one window can use a stand "
                        + "a later window needed. Placing all windows at once, when each flight may use only some stands, is "
                        + "NP-hard (interval scheduling with machine eligibility, Arkin and Silverberg 1987); the per-window "
                        + "matching is the polynomial-time trade-off, and holding absorbs the difference.";
        text(s, compare,
                "Work done in Java: " + in.lifted() + " flights sorted in O(n + k); " + in.windows().size()
                        + " windows; " + edges + " edges built from interval tree queries; " + aug + " augmenting paths; "
                        + in.holdChecks() + " more queries to hold " + held.size() + (held.size() == 1 ? " flight" : " flights")
                        + ". " + ms(in.totalMs()) + " in all.");
        s.put("apply", changed);
        List<String> focus = new ArrayList<>();
        for (String v : changed) {
            String st = in.plan().standOf(v);
            if (st != null && focus.size() < 80) {
                focus.add(st);
            }
        }
        s.put("focus", focus);
        brief(s, in.before() + " without a stand → " + after,
                (rescued - held.size()) + " placed by matching · " + held.size() + " held" + (held.isEmpty() ? "" : " (avg "
                        + waits / held.size() + " min)") + " · " + moved + " shifted to make room",
                !in.matching() ? "This plan repairs with greedy first-fit"
                        : gl > ml ? "Greedy re-plan on a copy leaves " + gl + " vs " + ml + ": matching saves " + (gl - ml)
                        : gl == ml ? "Greedy re-plan on a copy: same count, but only matching comes with a proof"
                        : "Greedy re-plan on a copy leaves " + gl + " vs " + ml + ": matching is best per window, "
                        + "windows run in order, and the all-at-once problem is NP-hard",
                "All in Java, " + ms(in.totalMs()) + ": " + edges + " edges, " + aug + " augmenting paths");
        s.put("minute", in.from());
        return s;
    }

    // ---------------------------------------------------------------- helpers

    private static Turnaround firstOverlap(PlanState plan, String standId, int from, int to, Set<String> skip) {
        RedBlackIntervalTree<String> tree = plan.tree(standId);
        if (tree == null) {
            return null;
        }
        for (RedBlackIntervalTree.Node<String> n : tree.overlaps(from, to)) {
            if (!skip.contains(n.value())) {
                return plan.visit(n.value());
            }
        }
        return null;
    }

    private static String name(Turnaround t) {
        String l = t.getLabel();
        int k = l.indexOf(" / ");
        return k < 0 ? l : l.substring(0, k);
    }

    /** A headline and two to four short points: what the card shows first. The full text stays one click away. */
    private static void brief(Map<String, Object> s, String lead, String... points) {
        s.put("lead", lead);
        List<String> p = new ArrayList<>();
        for (String x : points) {
            if (x != null && !x.isBlank()) {
                p.add(x);
            }
        }
        s.put("points", p);
    }

    /** One line: why the last stand on the path was no use to the first flight, or that it was an equal choice. */
    private static String shortNeed(Input in, Turnaround f, String end, List<String> chain) {
        for (RecoveryEngine.WindowInfo x : in.windows()) {
            if (x.visits().contains(f.getId()) && x.options().getOrDefault(f.getId(), List.of()).contains(end)) {
                return name(f) + " could also use " + end + ": matching maximises flights placed, not flights kept";
            }
        }
        Turnaround b = firstOverlap(in.plan(), end, f.getStart(), f.getOccupiedEnd(), new HashSet<>(chain));
        return b == null ? name(f) + " could not use " + end + " at its times"
                : name(f) + " could not take " + end + " directly: " + name(b) + " is there " + Clock.hhmm(b.getStart())
                        + " to " + Clock.hhmm(b.getOccupiedEnd());
    }

    private static String words(int n) {
        String[] w = {"No", "One", "Two", "Three", "Four", "Five"};
        return n < w.length ? w[n] : String.valueOf(n);
    }

    private static String ms(double v) {
        return v < 1 ? String.format("%.2f ms", v) : String.format("%.1f ms", v);
    }

    private static Map<String, Object> step(String kind, String tag, String title) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("kind", kind);
        s.put("tag", tag);
        s.put("title", title);
        s.put("text", new ArrayList<String>());
        s.put("facts", new ArrayList<List<String>>());
        return s;
    }

    @SuppressWarnings("unchecked")
    private static void text(Map<String, Object> s, String... paras) {
        List<String> t = (List<String>) s.get("text");
        for (String p : paras) {
            if (p != null && !p.isBlank()) {
                t.add(p.trim());
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static void fact(Map<String, Object> s, Object value, String label) {
        ((List<List<String>>) s.get("facts")).add(List.of(String.valueOf(value), label));
    }

    private static Map<String, String> mark(String stand, String tone) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("stand", stand);
        m.put("tone", tone);
        return m;
    }
}
