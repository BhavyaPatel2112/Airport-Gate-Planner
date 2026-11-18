package com.gateplanner.engine;

/** Formats minutes after midnight as HH:MM, adding "+1" for the next day. */
public final class Clock {

    private Clock() {
    }

    public static String hhmm(int minute) {
        int day = Math.floorDiv(minute, 1440);
        int m = Math.floorMod(minute, 1440);
        String s = String.format("%02d:%02d", m / 60, m % 60);
        return day > 0 ? s + " +1" : day < 0 ? s + " -1" : s;
    }
}
