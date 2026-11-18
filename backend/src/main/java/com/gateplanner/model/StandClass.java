package com.gateplanner.model;

/**
 * Compatibility class used by interval partitioning: terminal, international or domestic, and size.
 * Inside one class all stands are interchangeable, which is what makes the peak-overlap
 * lower bound tight.
 */
public record StandClass(String terminal, boolean international, SizeClass size) {

    public static StandClass of(Turnaround t) {
        return new StandClass(t.getTerminal(), t.isInternational(), t.getSize());
    }

    public static StandClass of(Stand s) {
        return new StandClass(s.getTerminal(), s.isInternational(), s.getSize());
    }

    /** Short label, for example "T2 international wide-body". */
    public String label() {
        return terminal + " " + (international ? "international" : "domestic") + " "
                + (size == SizeClass.WIDE ? "wide-body" : "narrow-body");
    }

    public String key() {
        return terminal + (international ? "-INTL-" : "-DOM-") + size;
    }
}
