package com.gateplanner.api;

import com.gateplanner.data.DataFormatException;
import com.gateplanner.engine.InfeasibleException;
import com.gateplanner.engine.InvalidInputException;
import com.gateplanner.engine.NoticeEngine;
import com.gateplanner.engine.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Turns exceptions into the error format {@code {error, message, details}}: 400 for invalid
 * input, 404 for unknown plans or flights, 422 for valid but impossible requests.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    public record ApiError(String error, String message, List<String> details) {
    }

    @ExceptionHandler({InvalidInputException.class, NoticeEngine.NoticeException.class, DataFormatException.class,
        IllegalArgumentException.class})
    public ResponseEntity<ApiError> badRequest(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError("INVALID_INPUT", e.getMessage(), List.of()));
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiError> notFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError("NOT_FOUND", e.getMessage(), List.of()));
    }

    @ExceptionHandler(InfeasibleException.class)
    public ResponseEntity<ApiError> infeasible(InfeasibleException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                .body(new ApiError("UNPROCESSABLE", e.getMessage(), List.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> validation(MethodArgumentNotValidException e) {
        List<String> details = new ArrayList<>();
        e.getBindingResult().getFieldErrors().forEach(f -> details.add(f.getField() + ": " + f.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("INVALID_INPUT", "Request body has invalid fields", details));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiError> unreadable(Exception e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("INVALID_INPUT", "Request could not be read: check the JSON and parameters",
                        List.of(e.getClass().getSimpleName())));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> state(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_CONTENT)
                .body(new ApiError("UNPROCESSABLE", e.getMessage(), List.of()));
    }

    static Map<String, Object> ok(String message) {
        return Map.of("message", message);
    }
}
