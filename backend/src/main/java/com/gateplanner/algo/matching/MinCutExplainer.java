package com.gateplanner.algo.matching;

import java.util.ArrayList;
import java.util.List;

/**
 * Explains why some flights could not be matched. After the maximum flow, the vertices reachable
 * from the source in the residual graph form the source side of a minimum cut. The flights on that
 * side, S, all compete for stands in N(S), the stands on that side, and |S| &gt; |N(S)|. This is a
 * Hall violator: by Hall's theorem no matching can place every flight in S, so the unmatched
 * flights are a proven shortage, not a weakness of the algorithm.
 *
 * <p><b>Time:</b> O(V + E) for one residual breadth-first search. <b>Space:</b> O(V).</p>
 */
public final class MinCutExplainer {

    /**
     * A set of flights and the only stands they can use.
     *
     * @param flights     left vertices in the violating set S
     * @param stands      right vertices in N(S)
     * @param unmatched   left vertices that stayed unmatched
     * @param cutCapacity capacity of the minimum cut, equal to the matching size
     */
    public record HallViolator(List<Integer> flights, List<Integer> stands, List<Integer> unmatched, int cutCapacity) {

        public int deficiency() {
            return flights.size() - stands.size();
        }
    }

    private MinCutExplainer() {
    }

    public static HallViolator explain(BipartiteMatcher matcher) {
        MaxFlowNetwork net = matcher.network();
        boolean[] reach = net.residualReachable(0);
        int left = matcher.leftCount();
        int right = matcher.rightCount();
        int[] match = matcher.matchLeft();
        List<Integer> s = new ArrayList<>();
        List<Integer> unmatched = new ArrayList<>();
        for (int i = 0; i < left; i++) {
            if (reach[1 + i]) {
                s.add(i);
            }
            if (match[i] < 0) {
                unmatched.add(i);
            }
        }
        List<Integer> ns = new ArrayList<>();
        for (int j = 0; j < right; j++) {
            if (reach[1 + left + j]) {
                ns.add(j);
            }
        }
        return new HallViolator(s, ns, unmatched, matcher.size());
    }
}
