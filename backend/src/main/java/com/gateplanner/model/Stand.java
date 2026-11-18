package com.gateplanner.model;

/**
 * A parking stand at Mumbai airport. Contact stands have a jet bridge; remote stands use buses.
 * The {@code source} field says whether the stand id was observed in the real flight data
 * ({@code observed}) or added to complete the layout ({@code assumed}).
 */
public final class Stand {

    private final String id;
    private final String terminal;
    private final SizeClass size;
    private final boolean contact;
    private final boolean international;
    private final double x;
    private final double y;
    private final String taxiway;
    private final String group;
    private final String source;

    public Stand(String id, String terminal, SizeClass size, boolean contact, boolean international,
                 double x, double y, String taxiway, String group, String source) {
        this.id = id;
        this.terminal = terminal;
        this.size = size;
        this.contact = contact;
        this.international = international;
        this.x = x;
        this.y = y;
        this.taxiway = taxiway;
        this.group = group;
        this.source = source;
    }

    public String getId() { return id; }
    public String getTerminal() { return terminal; }
    public SizeClass getSize() { return size; }
    public boolean isContact() { return contact; }
    public boolean isInternational() { return international; }
    public double getX() { return x; }
    public double getY() { return y; }
    public String getTaxiway() { return taxiway; }
    public String getGroup() { return group; }
    public String getSource() { return source; }

    /**
     * Hard compatibility rules: same terminal, international flights need an international stand
     * (and domestic flights a domestic one), wide-body aircraft need a wide stand.
     */
    public boolean canHost(Turnaround t) {
        if (!terminal.equals(t.getTerminal())) {
            return false;
        }
        if (international != t.isInternational()) {
            return false;
        }
        return t.getSize() == SizeClass.NARROW || size == SizeClass.WIDE;
    }
}
