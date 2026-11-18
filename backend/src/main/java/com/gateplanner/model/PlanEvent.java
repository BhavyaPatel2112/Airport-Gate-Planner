package com.gateplanner.model;

/** One change to the plan, for the frontend to animate. Times are minutes after midnight. */
public record PlanEvent(String flight, EventType type, String fromStand, String toStand, int time, String reason) {
}
