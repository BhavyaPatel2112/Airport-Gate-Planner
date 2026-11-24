package com.gateplanner.model;

/**
 * One stand visit: the time an aircraft occupies a stand. When an arrival and a departure share the
 * same aircraft registration they are paired into one visit (on block to off block). Otherwise a
 * standard turnaround is assumed: 45 minutes for a narrow-body, 90 minutes for a wide-body.
 *
 * <p>The occupied interval is half-open: {@code [start, end + buffer)}. The buffer protects the next
 * aircraft on the same stand from a late departure.</p>
 */
public final class Turnaround {

    public static final int NARROW_TURN = 45;
    public static final int WIDE_TURN = 90;

    private final String id;
    private final Flight arrival;
    private final Flight departure;
    private final SizeClass size;
    private final boolean international;
    private final String terminal;
    private final String airlineCode;
    private final String airline;
    private final String registration;
    private final boolean paired;
    private final boolean synthetic;
    private final int schedStart;
    private final int schedEnd;
    private final int actualStart;
    private final int actualEnd;

    private int start;
    private int end;
    private int buffer;
    private boolean cancelled;

    public Turnaround(String id, Flight arrival, Flight departure, SizeClass size, boolean international,
                      String terminal, String airlineCode, String airline, String registration, boolean paired,
                      boolean synthetic, int schedStart, int schedEnd, int actualStart, int actualEnd) {
        this.id = id;
        this.arrival = arrival;
        this.departure = departure;
        this.size = size;
        this.international = international;
        this.terminal = terminal;
        this.airlineCode = airlineCode;
        this.airline = airline;
        this.registration = registration;
        this.paired = paired;
        this.synthetic = synthetic;
        this.schedStart = schedStart;
        this.schedEnd = schedEnd;
        this.actualStart = actualStart;
        this.actualEnd = actualEnd;
        this.start = schedStart;
        this.end = schedEnd;
    }

    /** Deep copy so every plan can change times without touching the loaded data. */
    public Turnaround copy() {
        Turnaround t = new Turnaround(id, arrival, departure, size, international, terminal, airlineCode, airline,
                registration, paired, synthetic, schedStart, schedEnd, actualStart, actualEnd);
        t.start = start;
        t.end = end;
        t.buffer = buffer;
        t.cancelled = cancelled;
        return t;
    }

    /** Copy of this visit flown by a different aircraft size (an aircraft swap); times and buffer are kept. */
    public Turnaround resized(SizeClass newSize) {
        Turnaround t = new Turnaround(id, arrival, departure, newSize, international, terminal, airlineCode, airline,
                registration, paired, synthetic, schedStart, schedEnd, actualStart, actualEnd);
        t.start = start;
        t.end = end;
        t.buffer = buffer;
        t.cancelled = cancelled;
        return t;
    }

    public String getId() { return id; }
    public Flight getArrival() { return arrival; }
    public Flight getDeparture() { return departure; }
    public SizeClass getSize() { return size; }
    public boolean isInternational() { return international; }
    public String getTerminal() { return terminal; }
    public String getAirlineCode() { return airlineCode; }
    public String getAirline() { return airline; }
    public String getRegistration() { return registration; }
    public boolean isPaired() { return paired; }
    public boolean isSynthetic() { return synthetic; }
    public int getSchedStart() { return schedStart; }
    public int getSchedEnd() { return schedEnd; }
    public int getActualStart() { return actualStart; }
    public int getActualEnd() { return actualEnd; }
    public int getStart() { return start; }
    public int getEnd() { return end; }
    public int getBuffer() { return buffer; }
    public boolean isCancelled() { return cancelled; }

    /** End of the protected interval, including the buffer. */
    public int getOccupiedEnd() { return end + buffer; }

    public void setTimes(int start, int end) {
        if (end <= start) {
            throw new IllegalArgumentException("Stand visit must end after it starts");
        }
        this.start = start;
        this.end = end;
    }

    public void setBuffer(int buffer) { this.buffer = Math.max(0, buffer); }
    public void setCancelled(boolean cancelled) { this.cancelled = cancelled; }

    /** Display label, for example "AI 2927 / AI 2928". */
    public String getLabel() {
        if (arrival != null && departure != null) {
            return arrival.getNumber() + " / " + departure.getNumber();
        }
        return arrival != null ? arrival.getNumber() : departure.getNumber();
    }

    /** The flight shown first for this visit (the arrival when there is one). */
    public Flight primary() {
        return arrival != null ? arrival : departure;
    }

    public boolean overlaps(int s, int e) {
        return start < e && s < getOccupiedEnd();
    }
}
