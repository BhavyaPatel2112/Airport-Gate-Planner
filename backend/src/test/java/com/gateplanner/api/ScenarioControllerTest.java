package com.gateplanner.api;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ScenarioControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void planRemembersItsRecoveryMethod() throws Exception {
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"day\":1,\"bufferPercentile\":75,\"recovery\":\"greedy\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recovery").value("GREEDY"));
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON).content("{\"day\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recovery").value("MATCHING"));
        mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"day\":1,\"recovery\":\"random\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void groundDelayHoldsArrivalsAndValidates() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/ground-delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":420,\"to\":540,\"minutes\":45}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(containsString("held 45 min")))
                .andExpect(jsonPath("$.events.length()").value(greaterThan(5)));
        mvc.perform(post("/api/plan/" + id + "/ground-delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":420,\"to\":540,\"minutes\":2}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan/" + id + "/ground-delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":540,\"to\":420,\"minutes\":30}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aircraftSwapMovesToAWideStand() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/swap").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"VZ760\",\"size\":\"WIDE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(containsString("wide-body")));
        mvc.perform(post("/api/plan/" + id + "/swap").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"VZ760\",\"size\":\"WIDE\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan/" + id + "/swap").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"VZ760\",\"size\":\"HUGE\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void replanNeverStrandsMoreFlightsAndValidates() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        String rush = mvc.perform(post("/api/plan/" + id + "/rush").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\":120,\"seed\":5,\"atMinute\":600}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Integer before = JsonPath.read(rush, "$.stats.unplaced");
        mvc.perform(post("/api/plan/" + id + "/replan").contentType(MediaType.APPLICATION_JSON).content("{\"from\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(containsString("Re-planned")))
                .andExpect(jsonPath("$.stats.unplaced").value(lessThanOrEqualTo(before)));
        mvc.perform(post("/api/plan/" + id + "/replan").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void movedFlightsSayWhyTheyMovedAndWhyThatStand() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB STANDS 65A,65B,66,67A,67B,68 CLSD 0100-0300 DUE WORK IN PROGRESS\",\"mode\":\"apply\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan.events[?(@.type == 'MOVE')].reason",
                        hasItem(containsString("is closed from 01:00 to 03:00"))));
    }

    @Test
    void replanExplainsEachAlgorithmOnceWithMeasuredNumbers() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/rush").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\":120,\"seed\":5,\"atMinute\":600}"))
                .andExpect(status().isOk());
        String body = mvc.perform(post("/api/plan/" + id + "/replan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":600,\"hold\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshots.replan.steps[0].kind").value("collect"))
                .andExpect(jsonPath("$.snapshots.replan.steps[-1].kind").value("summary"))
                .andExpect(jsonPath("$.snapshots.replan.steps[0].text[1]").value(containsString("Counting sort")))
                .andReturn().getResponse().getContentAsString();
        java.util.List<String> kinds = JsonPath.read(body, "$.snapshots.replan.steps[*].kind");
        org.junit.jupiter.api.Assertions.assertEquals(kinds.size(), new java.util.HashSet<>(kinds).size(), "a step repeats: " + kinds);
        java.util.List<String> text = JsonPath.read(body, "$.snapshots.replan.steps[*].text[*]");
        for (String t : text) {
            org.junit.jupiter.api.Assertions.assertFalse(t.contains("\u2014"), "em dash in: " + t);
        }
        // the replay belongs to that answer only
        mvc.perform(post("/api/plan/" + id + "/delay").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"flight\":\"6E5062\",\"minutes\":5,\"atMinute\":300}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshots.replan").doesNotExist());
    }

    @Test
    void holdingStrandedFlightsLeavesFewerWithoutAStand() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/rush").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\":120,\"seed\":5,\"atMinute\":600}"))
                .andExpect(status().isOk());
        String plain = mvc.perform(post("/api/plan/" + id + "/replan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":0}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        Integer left = JsonPath.read(plain, "$.stats.unplaced");
        mvc.perform(post("/api/plan/" + id + "/replan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"from\":0,\"hold\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value(containsString("held until a stand freed")))
                .andExpect(jsonPath("$.stats.unplaced").value(lessThanOrEqualTo(left)));
    }
}
