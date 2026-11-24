package com.gateplanner.algo.exact;

import com.gateplanner.bench.BenchmarkRunner;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExactGateSolverTest {

    @Test
    void trivialInput() {
        ExactGateSolver.Problem p = new ExactGateSolver.Problem(new int[] {0}, new int[] {45},
                new int[][] {{0, 3}}, 20);
        ExactGateSolver.Solution s = ExactGateSolver.branchAndBound(p);
        assertEquals(0, s.cost());
        assertEquals(0, s.assignment()[0]);
    }

    @Test
    void knownOptimum() {
        // two overlapping flights, one contact stand (cost 0) and one remote (cost 3)
        ExactGateSolver.Problem p = new ExactGateSolver.Problem(new int[] {0, 10}, new int[] {60, 70},
                new int[][] {{0, 3}, {0, 3}}, 20);
        assertEquals(3, ExactGateSolver.branchAndBound(p).cost());
        // a third overlapping flight has nowhere to go
        ExactGateSolver.Problem q = new ExactGateSolver.Problem(new int[] {0, 10, 20}, new int[] {60, 70, 80},
                new int[][] {{0, 3}, {0, 3}, {0, 3}}, 20);
        assertEquals(23, ExactGateSolver.branchAndBound(q).cost());
    }

    @Test
    void refusesOversizeInput() {
        ExactGateSolver.Problem p = BenchmarkRunner.exactProblem(ExactGateSolver.MAX_FLIGHTS + 1, 1);
        assertThrows(IllegalArgumentException.class, () -> ExactGateSolver.branchAndBound(p));
        assertThrows(IllegalArgumentException.class,
                () -> ExactGateSolver.bruteForce(BenchmarkRunner.exactProblem(ExactGateSolver.MAX_BRUTE_FORCE + 1, 1)));
    }

    @Test
    void neverWorseThanHeuristic() {
        for (long seed = 0; seed < 25; seed++) {
            ExactGateSolver.Problem p = BenchmarkRunner.exactProblem(12, seed);
            assertTrue(ExactGateSolver.branchAndBound(p).cost() <= ExactGateSolver.heuristic(p).cost());
        }
    }

    @Test
    void matchesBruteForce() {
        for (long seed = 0; seed < 25; seed++) {
            ExactGateSolver.Problem p = BenchmarkRunner.exactProblem(8, seed);
            assertEquals(ExactGateSolver.bruteForce(p).cost(), ExactGateSolver.branchAndBound(p).cost());
        }
    }

    @Test
    void solutionHasNoOverlapsOnAStand() {
        ExactGateSolver.Problem p = BenchmarkRunner.exactProblem(14, 3);
        int[] a = ExactGateSolver.branchAndBound(p).assignment();
        for (int i = 0; i < a.length; i++) {
            for (int j = i + 1; j < a.length; j++) {
                if (a[i] >= 0 && a[i] == a[j]) {
                    assertTrue(p.end()[i] <= p.start()[j] || p.end()[j] <= p.start()[i]);
                }
            }
        }
    }

    @Test
    void rejectsBadIntervals() {
        assertThrows(IllegalArgumentException.class,
                () -> new ExactGateSolver.Problem(new int[] {10}, new int[] {10}, new int[][] {{0}}, 20));
    }
}
