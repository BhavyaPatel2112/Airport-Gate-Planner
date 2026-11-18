package com.gateplanner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Mumbai Airport, Live gate planner backend.
 * Every assessed algorithm runs inside this Java process; the web frontend only draws results.
 */
@SpringBootApplication
public class GatePlannerApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatePlannerApplication.class, args);
    }
}
