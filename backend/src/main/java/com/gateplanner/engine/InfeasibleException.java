package com.gateplanner.engine;

/** Valid input that cannot be processed, such as an exact solve that is too large. Mapped to HTTP 422. */
public class InfeasibleException extends RuntimeException {
    public InfeasibleException(String message) {
        super(message);
    }
}
