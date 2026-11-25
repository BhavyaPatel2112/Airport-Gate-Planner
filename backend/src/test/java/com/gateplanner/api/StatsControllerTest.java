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
class StatsControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void leaderboardAndTiming() throws Exception {
        mvc.perform(get("/api/stats/delays?percentile=90&seed=42")).andExpect(status().isOk())
                .andExpect(jsonPath("$.airlines.length()").value(greaterThan(3)))
                .andExpect(jsonPath("$.timing.n").value(greaterThan(500)));
    }

    @Test
    void percentileOutOfRangeIs400() throws Exception {
        mvc.perform(get("/api/stats/delays?percentile=120")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/stats/delays?percentile=abc")).andExpect(status().isBadRequest());
    }
}
