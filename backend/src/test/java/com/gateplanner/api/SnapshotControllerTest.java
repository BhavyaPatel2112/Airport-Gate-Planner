package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SnapshotControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void redBlackTreeSnapshotForAStand() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(get("/api/snapshots/rbtree?plan=" + id + "&stand=40A")).andExpect(status().isOk())
                .andExpect(jsonPath("$.nodes.length()").value(greaterThan(0)));
    }

    @Test
    void fibHeapSnapshotAfterRadarAndCancel() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(get("/api/plan/" + id + "/radar?minute=600")).andExpect(status().isOk());
        mvc.perform(get("/api/snapshots/fibheap?plan=" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.roots").exists());
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"VABB STAND 42A CLSD 0900-1000\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/snapshots/suffix?plan=" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.path").exists());
    }

    @Test
    void errors() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(get("/api/snapshots/bogus?plan=" + id)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/snapshots/rbtree?plan=" + id + "&stand=999")).andExpect(status().isNotFound());
        mvc.perform(get("/api/snapshots/matching?plan=nope")).andExpect(status().isNotFound());
    }
}
