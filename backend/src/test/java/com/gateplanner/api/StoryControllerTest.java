package com.gateplanner.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class StoryControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void theStoryFlightLandsSoonerWithThePlannerThanWithTheFixedPlan() throws Exception {
        String body = mvc.perform(get("/api/story/arrival?day=1")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals("AI 116", JsonPath.read(body, "$.flight.number"));
        int fixed = JsonPath.read(body, "$.today.hold");
        int ours = JsonPath.read(body, "$.ours.hold");
        assertTrue(fixed > ours, "fixed plan " + fixed + " min, planner " + ours + " min");
        int delayed = JsonPath.read(body, "$.today.heldFlights");
        int oursDelayed = JsonPath.read(body, "$.ours.heldFlights");
        assertTrue(oursDelayed <= delayed);
        // both plans are kept, so the browser can draw them
        for (String k : new String[] {"today", "ours"}) {
            String id = JsonPath.read(body, "$." + k + ".planId");
            mvc.perform(get("/api/plan/" + id)).andExpect(status().isOk());
        }
    }
}
