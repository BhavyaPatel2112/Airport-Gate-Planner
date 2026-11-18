package com.gateplanner.model;

/** Aircraft or stand size. A wide-body stand can also take a narrow-body aircraft. */
public enum SizeClass {
    NARROW,
    WIDE;

    /** Classifies an aircraft model string from the flight data. */
    public static SizeClass fromAircraft(String model) {
        if (model == null) {
            return NARROW;
        }
        String m = model.toUpperCase().replace("AIRBUS ", "A").replace("BOEING ", "B");
        String[] wide = {"A330", "A340", "A350", "A380", "B777", "B787", "B747", "B767"};
        for (String w : wide) {
            if (m.contains(w)) {
                return WIDE;
            }
        }
        return NARROW;
    }
}
