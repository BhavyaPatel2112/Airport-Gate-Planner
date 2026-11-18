package com.gateplanner.model;

/**
 * One real flight movement (an arrival or a departure) at Mumbai, as loaded from the CSV files.
 * Times are minutes after local midnight of the chosen day (IST). A scheduled time can be negative
 * when a flight was planned for the previous evening but actually moved after midnight.
 */
public final class Flight {

    private final String number;
    private final String airlineCode;
    private final String airline;
    private final MovementType type;
    private final String aircraft;
    private final SizeClass size;
    private final boolean international;
    private final String otherAirport;
    private final String city;
    private final int scheduledMin;
    private final int actualMin;
    private final String terminal;
    private final String registration;
    private final boolean cancelled;
    private final String realGate;
    private final boolean actualMissing;

    public Flight(String number, String airlineCode, String airline, MovementType type, String aircraft,
                  SizeClass size, boolean international, String otherAirport, String city, int scheduledMin,
                  int actualMin, String terminal, String registration, boolean cancelled, String realGate,
                  boolean actualMissing) {
        this.number = number;
        this.airlineCode = airlineCode;
        this.airline = airline;
        this.type = type;
        this.aircraft = aircraft;
        this.size = size;
        this.international = international;
        this.otherAirport = otherAirport;
        this.city = city;
        this.scheduledMin = scheduledMin;
        this.actualMin = actualMin;
        this.terminal = terminal;
        this.registration = registration;
        this.cancelled = cancelled;
        this.realGate = realGate;
        this.actualMissing = actualMissing;
    }

    public String getNumber() { return number; }
    public String getAirlineCode() { return airlineCode; }
    public String getAirline() { return airline; }
    public MovementType getType() { return type; }
    public String getAircraft() { return aircraft; }
    public SizeClass getSize() { return size; }
    public boolean isInternational() { return international; }
    public String getOtherAirport() { return otherAirport; }
    public String getCity() { return city; }
    public int getScheduledMin() { return scheduledMin; }
    public int getActualMin() { return actualMin; }
    public String getTerminal() { return terminal; }
    public String getRegistration() { return registration; }
    public boolean isCancelled() { return cancelled; }
    public String getRealGate() { return realGate; }
    public boolean isActualMissing() { return actualMissing; }

    /** Real delay in minutes (actual minus scheduled). Negative means early. */
    public int getDelayMin() { return actualMin - scheduledMin; }

    /** Flight number without spaces, used as a search key, for example AI2927. */
    public String getKey() { return number.replace(" ", ""); }
}
