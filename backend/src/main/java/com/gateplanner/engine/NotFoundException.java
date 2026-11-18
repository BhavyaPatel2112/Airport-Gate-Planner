package com.gateplanner.engine;

/** Unknown plan, flight or stand. Mapped to HTTP 404. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
