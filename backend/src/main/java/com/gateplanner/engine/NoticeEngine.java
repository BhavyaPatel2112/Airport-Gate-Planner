package com.gateplanner.engine;

import com.gateplanner.algo.text.KmpMatcher;
import com.gateplanner.algo.text.SuffixTree;
import com.gateplanner.model.Closure;
import com.gateplanner.model.Notice;
import com.gateplanner.model.PlanState;
import com.gateplanner.model.Stand;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Parses and validates airport notices and indexes their text with a suffix tree.
 *
 * <p>Supported items: {@code STAND <id> CLSD [HHMM-HHMM]}, {@code STANDS <a>-<b> CLSD ...},
 * {@code STANDS <id>,<id> CLSD ...} and {@code TWY <id> CLSD ...} (closes the stands that taxiway
 * serves). Runway closures and other items are accepted as text and flagged as outside this model.</p>
 *
 * <p>On every replan the suffix tree over all active notice text is queried for every stand id and
 * taxiway id ({@code " 42A "} with spaces, so 42 does not match 142): one O(n log n) build, then
 * O(m + occ) per id. Knuth-Morris-Pratt would rescan the whole text for each id.</p>
 */
public final class NoticeEngine {

    /** A notice that fails validation. Mapped to HTTP 400. */
    public static final class NoticeException extends RuntimeException {
        public NoticeException(String message) {
            super(message);
        }
    }

    /** The suffix tree index over all notices. */
    public record Index(SuffixTree tree, String text, List<String> ids, List<int[]> spans, double buildMs) {

        /** Which notice a text position falls in. */
        public int noticeAt(int pos) {
            for (int i = 0; i < spans.size(); i++) {
                if (pos >= spans.get(i)[0] && pos < spans.get(i)[1]) {
                    return i;
                }
            }
            return -1;
        }
    }

    /** One search hit inside a notice. */
    public record Hit(String noticeId, String text, int from, int to) {
    }

    /** Search result with the suffix tree path and the KMP comparison. */
    public record SearchOutcome(String query, List<Hit> hits, List<SuffixTree.PathStep> path, double suffixTreeMs,
                                double kmpMs, int textLength, int treeNodes) {
    }

    private final Map<String, Stand> stands = new LinkedHashMap<>();
    private final Map<String, List<String>> taxiwayStands = new LinkedHashMap<>();
    private final Set<String> otherTaxiways = Set.of("A", "B", "K2");

    public NoticeEngine(List<Stand> standList) {
        for (Stand s : standList) {
            stands.put(s.getId(), s);
            taxiwayStands.computeIfAbsent(s.getTaxiway(), k -> new ArrayList<>()).add(s.getId());
        }
    }

    public Set<String> taxiways() {
        Set<String> t = new LinkedHashSet<>(taxiwayStands.keySet());
        t.addAll(otherTaxiways);
        return t;
    }

    public static String normalise(String text) {
        if (text == null) {
            return "";
        }
        return text.toUpperCase().trim().replaceAll("\\s+", " ");
    }

    /**
     * Parses one notice.
     *
     * @throws NoticeException with a clear message when the notice is invalid
     */
    public Notice parse(String id, String raw) {
        String text = normalise(raw);
        if (text.isEmpty()) {
            throw new NoticeException("Notice is empty");
        }
        String[] tok = text.split(" ");
        if (!tok[0].equals("VABB")) {
            throw new NoticeException("Notice must start with the airport code VABB (Mumbai), found " + tok[0]);
        }
        if (tok.length < 2) {
            throw new NoticeException("Notice has nothing after VABB");
        }
        String item = tok[1];
        switch (item) {
            case "STAND":
            case "STANDS": {
                if (tok.length < 3) {
                    throw new NoticeException("Give a stand id after " + item);
                }
                List<String> ids = item.equals("STAND") ? List.of(checkStand(tok[2])) : expand(tok[2]);
                return closureNotice(id, text, "STAND", ids, tok, 3);
            }
            case "TWY": {
                if (tok.length < 3) {
                    throw new NoticeException("Give a taxiway id after TWY");
                }
                String twy = tok[2];
                if (!taxiways().contains(twy)) {
                    throw new NoticeException("Taxiway " + twy + " not found. Known taxiways: " + String.join(", ", taxiways()));
                }
                List<String> served = taxiwayStands.getOrDefault(twy, List.of());
                if (served.isEmpty()) {
                    int[] w = window(tok, 4);
                    return new Notice(id, text, "TAXIWAY", List.of(), w[0], w[1], false,
                            "Taxiway " + twy + " does not lead to any stand; outside this model (stands only).");
                }
                return closureNotice(id, text, "TAXIWAY", served, tok, 3);
            }
            case "RWY": {
                int[] w = tok.length > 4 ? window(tok, 4) : new int[] {0, PlanState.HORIZON};
                return new Notice(id, text, "RUNWAY", List.of(), w[0], w[1], false,
                        "Runway notices are accepted as text but are outside this model, which plans stands only.");
            }
            default:
                return new Notice(id, text, "INFO", List.of(), 0, PlanState.HORIZON, false,
                        "Information only: this item does not change stand availability.");
        }
    }

    private Notice closureNotice(String id, String text, String kind, List<String> ids, String[] tok, int verbAt) {
        if (tok.length <= verbAt || !tok[verbAt].equals("CLSD")) {
            return new Notice(id, text, kind, ids, 0, PlanState.HORIZON, false,
                    "Information only: only CLSD (closed) changes the plan.");
        }
        int[] w = window(tok, verbAt + 1);
        String when = w[0] == 0 && w[1] == PlanState.HORIZON ? "all day"
                : Clock.hhmm(w[0]) + " to " + Clock.hhmm(w[1]);
        String what = ids.size() == 1 ? "Stand " + ids.get(0) : ids.size() + " stands (" + String.join(", ", ids) + ")";
        return new Notice(id, text, kind, ids, w[0], w[1], true, what + " closed " + when + ".");
    }

    /** Reads an optional HHMM-HHMM window at {@code at}; no window means the whole day. */
    private int[] window(String[] tok, int at) {
        if (tok.length <= at || !tok[at].matches("\\d{4}-\\d{4}")) {
            return new int[] {0, PlanState.HORIZON};
        }
        String[] p = tok[at].split("-");
        int from = minutes(p[0]);
        int to = minutes(p[1]);
        if (to == from) {
            throw new NoticeException("Notice start and end time are the same (" + p[0] + ")");
        }
        if (to < from) {
            throw new NoticeException("Notice end time " + p[1] + " is before start time " + p[0]);
        }
        return new int[] {from, to};
    }

    private int minutes(String hhmm) {
        int h = Integer.parseInt(hhmm.substring(0, 2));
        int m = Integer.parseInt(hhmm.substring(2));
        if (h > 24 || m > 59 || (h == 24 && m > 0)) {
            throw new NoticeException("Time " + hhmm + " is not a valid HHMM time");
        }
        return h * 60 + m;
    }

    private String checkStand(String id) {
        if (!stands.containsKey(id)) {
            throw new NoticeException("Stand " + id + " not found");
        }
        return id;
    }

    private List<String> expand(String spec) {
        List<String> out = new ArrayList<>();
        if (spec.contains(",")) {
            for (String s : spec.split(",")) {
                if (!s.isEmpty()) {
                    out.add(checkStand(s));
                }
            }
            return out;
        }
        if (!spec.matches("\\d+-\\d+")) {
            return List.of(checkStand(spec));
        }
        String[] p = spec.split("-");
        int a = Integer.parseInt(p[0]);
        int b = Integer.parseInt(p[1]);
        if (b < a) {
            throw new NoticeException("Stand range " + spec + " runs backwards");
        }
        for (String id : stands.keySet()) {
            String digits = id.replaceAll("^(\\d+).*$", "$1");
            if (digits.matches("\\d+")) {
                int n = Integer.parseInt(digits);
                if (n >= a && n <= b) {
                    out.add(id);
                }
            }
        }
        if (out.isEmpty()) {
            throw new NoticeException("No stands found in range " + spec);
        }
        return out;
    }

    /** Closures created by a notice (none for notices outside the model). */
    public static List<Closure> closuresOf(Notice n) {
        List<Closure> out = new ArrayList<>();
        if (!n.inModel()) {
            return out;
        }
        for (String s : n.standIds()) {
            out.add(new Closure(s, n.from(), n.to(), n.id(), n.text()));
        }
        return out;
    }

    /** Builds the suffix tree over all notices: one line per notice, padded with spaces. */
    public Index index(List<Notice> notices) {
        long t0 = System.nanoTime();
        StringBuilder b = new StringBuilder();
        List<String> ids = new ArrayList<>();
        List<int[]> spans = new ArrayList<>();
        for (Notice n : notices) {
            int start = b.length();
            b.append(' ').append(n.text().replace(",", " , ")).append(" \n");
            ids.add(n.id());
            spans.add(new int[] {start, b.length()});
        }
        String text = b.toString();
        SuffixTree tree = new SuffixTree(text);
        return new Index(tree, text, ids, spans, TraceRecorder.since(t0));
    }

    /**
     * For every stand id and taxiway id, the notices that mention it, found with the suffix tree.
     * Returns only ids with at least one mention.
     */
    public Map<String, List<String>> mentions(Index idx, Collection<String> standIds, TraceRecorder trace) {
        long t0 = System.nanoTime();
        Map<String, List<String>> out = new LinkedHashMap<>();
        int searches = 0;
        int patternChars = 0;
        List<String> patterns = new ArrayList<>();
        for (String s : standIds) {
            patterns.add(" " + s + " ");
        }
        for (String t : taxiways()) {
            patterns.add(" TWY " + t + " ");
        }
        for (String p : patterns) {
            searches++;
            patternChars += p.length();
            for (int pos : idx.tree().search(p)) {
                int n = idx.noticeAt(pos);
                if (n >= 0) {
                    List<String> list = out.computeIfAbsent(p.trim(), k -> new ArrayList<>());
                    if (!list.contains(idx.ids().get(n))) {
                        list.add(idx.ids().get(n));
                    }
                }
            }
        }
        double treeMs = TraceRecorder.since(t0) + idx.buildMs();
        long t1 = System.nanoTime();
        for (String p : patterns) {
            KmpMatcher.search(idx.text(), p);
        }
        double kmpMs = TraceRecorder.since(t1);
        if (trace != null) {
            trace.add("Suffix tree (from suffix array and LCP)", 4, searches + " stand and taxiway ids searched in "
                            + idx.ids().size() + " notices", idx.text().length() + patternChars, treeMs,
                    "O(n log n) build, O(m + occ) per search",
                    "Built once, then each id walks one root path. KMP baseline for the same " + searches
                            + " searches: " + kmpMs + " ms (O(n + m) each)");
        }
        return out;
    }

    /** Free text search over the notices, with the path walked in the tree. */
    public SearchOutcome search(Index idx, String query) {
        String q = normalise(query);
        if (q.isEmpty()) {
            throw new NoticeException("Search text is empty");
        }
        long t0 = System.nanoTime();
        SuffixTree.SearchResult r = idx.tree().find(q);
        double treeMs = TraceRecorder.since(t0);
        long t1 = System.nanoTime();
        KmpMatcher.search(idx.text(), q);
        double kmpMs = TraceRecorder.since(t1);
        List<Hit> hits = new ArrayList<>();
        for (int pos : r.positions()) {
            int n = idx.noticeAt(pos);
            if (n >= 0) {
                int[] span = idx.spans().get(n);
                hits.add(new Hit(idx.ids().get(n), idx.text().substring(span[0], span[1]).trim(),
                        pos - span[0] - 1, pos - span[0] - 1 + q.length()));
            }
        }
        return new SearchOutcome(q, hits, r.path(), treeMs, kmpMs, idx.text().length(), idx.tree().nodeCount());
    }
}
