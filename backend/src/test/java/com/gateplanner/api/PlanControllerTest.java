package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PlanControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void createPlanReturnsCertificateAndTrace() throws Exception {
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON).content("{\"day\":1,\"bufferPercentile\":90}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.placed").value(greaterThan(600)))
                .andExpect(jsonPath("$.certificate.classes.length()").value(greaterThan(3)))
                .andExpect(jsonPath("$.trace.length()").value(greaterThanOrEqualTo(5)));
    }

    @Test
    void createPlanValidatesInput() throws Exception {
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON).content("{\"day\":5}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.details.length()").value(1));
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON).content("{\"day\":1,\"bufferPercentile\":20}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON).content("not json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownPlanIs404() throws Exception {
        mvc.perform(get("/api/plan/nope")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        mvc.perform(get("/api/plan/nope/occupancy")).andExpect(status().isNotFound());
    }

    @Test
    void delayAndCancelFlow() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"AI2927\",\"minutes\":45,\"atMinute\":600}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.events.length()").value(greaterThan(0)));
        mvc.perform(post("/api/plan/" + id + "/delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"AI2927\",\"minutes\":-5}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan/" + id + "/delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"AI2927\",\"minutes\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.events.length()").value(0));
        mvc.perform(post("/api/plan/" + id + "/delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"XX0000\",\"minutes\":10}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/plan/" + id + "/cancel").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"AI2927\",\"atMinute\":600}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/plan/" + id + "/cancel").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"AI2927\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void occupancyBusiestWhyRaceAndRealTimes() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(get("/api/plan/" + id + "/occupancy")).andExpect(status().isOk())
                .andExpect(jsonPath("$.minutes.length()").value(1440));
        mvc.perform(get("/api/plan/" + id + "/busiest?window=30")).andExpect(status().isOk())
                .andExpect(jsonPath("$.window").value(30));
        mvc.perform(get("/api/plan/" + id + "/busiest?window=1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/plan/" + id + "/why/AI2927")).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PLACED"));
        mvc.perform(get("/api/plan/" + id + "/why/ZZ1")).andExpect(status().isNotFound());
        mvc.perform(post("/api/plan/" + id + "/race")).andExpect(status().isOk())
                .andExpect(jsonPath("$.textbook.matchingPlaced").value(2))
                .andExpect(jsonPath("$.textbook.greedyPlaced").value(1));
        mvc.perform(post("/api/plan/" + id + "/real-times")).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").exists());
    }
}
