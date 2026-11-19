package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class FlightControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void flightsForADay() throws Exception {
        mvc.perform(get("/api/flights?day=1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(greaterThan(800)))
                .andExpect(jsonPath("$.date").value("2026-11-16"));
    }

    @Test
    void unknownDayIs400() throws Exception {
        mvc.perform(get("/api/flights?day=3")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_INPUT"));
    }

    @Test
    void trieSearchAutocompletes() throws Exception {
        mvc.perform(get("/api/flights/search?q=AI2&day=1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(greaterThan(0)));
    }

    @Test
    void blankSearchIs400() throws Exception {
        mvc.perform(get("/api/flights/search").param("q", " ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/flights/search")).andExpect(status().isBadRequest());
    }

    @Test
    void standsAreListed() throws Exception {
        mvc.perform(get("/api/stands")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(greaterThan(100)));
    }
}
