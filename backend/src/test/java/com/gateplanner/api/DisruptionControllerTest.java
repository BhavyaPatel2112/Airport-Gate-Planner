package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThan;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DisruptionControllerTest {

    @Autowired
    private MockMvc mvc;

    private String storm(String id) throws Exception {
        String body = mvc.perform(post("/api/plan/" + id + "/storm").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"severityPercentile\":90,\"seed\":7,\"from\":840,\"to\":1020}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return body.substring(body.indexOf("\"summary\""), body.indexOf("\"stats\""));
    }

    @Test
    void sameSeedGivesTheSameStorm() throws Exception {
        String a = storm(ApiTestSupport.newPlan(mvc));
        String b = storm(ApiTestSupport.newPlan(mvc));
        assertEquals(a, b);
    }

    @Test
    void stormValidatesSeverity() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/storm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"severityPercentile\":10}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan/" + id + "/storm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"severityPercentile\":90,\"from\":900,\"to\":800}")).andExpect(status().isBadRequest());
    }

    @Test
    void rushHourAddsSimulatedArrivals() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/rush").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\":20,\"seed\":3,\"atMinute\":360}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary").exists());
        mvc.perform(post("/api/plan/" + id + "/rush").contentType(MediaType.APPLICATION_JSON)
                .content("{\"count\":0}")).andExpect(status().isBadRequest());
    }

    @Test
    void radarAndBoard() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(get("/api/plan/" + id + "/radar?minute=600")).andExpect(status().isOk())
                .andExpect(jsonPath("$.nextFree.length()").value(greaterThan(0)));
        mvc.perform(get("/api/plan/" + id + "/board?minute=600&count=10")).andExpect(status().isOk())
                .andExpect(jsonPath("$.rows.length()").value(10));
        mvc.perform(get("/api/plan/" + id + "/board?minute=600&count=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/plan/" + id + "/radar?minute=-5")).andExpect(status().isBadRequest());
    }

    @Test
    void unknownPlanIs404() throws Exception {
        mvc.perform(post("/api/plan/missing/storm").contentType(MediaType.APPLICATION_JSON)
                .content("{\"severityPercentile\":90}")).andExpect(status().isNotFound());
    }
}
