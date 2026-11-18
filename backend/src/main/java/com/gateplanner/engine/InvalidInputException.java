package com.gateplanner.engine;

/** Input that breaks a rule, such as a negative delay. Mapped to HTTP 400. */
public class InvalidInputException extends RuntimeException {
    public InvalidInputException(String message) {
        super(message);
    }
}
