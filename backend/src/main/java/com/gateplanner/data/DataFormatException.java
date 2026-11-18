package com.gateplanner.data;

/** Thrown when an input file is empty or malformed. Carries the line number when known. */
public class DataFormatException extends RuntimeException {

    private final int line;

    public DataFormatException(String message, int line) {
        super(line > 0 ? message + " (line " + line + ")" : message);
        this.line = line;
    }

    public int getLine() {
        return line;
    }
}
