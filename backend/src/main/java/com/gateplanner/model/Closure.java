package com.gateplanner.model;

/**
 * A stand closure created from an airport notice. The stand is unusable during {@code [from, to)}.
 */
public record Closure(String standId, int from, int to, String noticeId, String reason) {

    public boolean overlaps(int s, int e) {
        return from < e && s < to;
    }
}
