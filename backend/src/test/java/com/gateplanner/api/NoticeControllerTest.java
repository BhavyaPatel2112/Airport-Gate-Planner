package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class NoticeControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void previewThenApplyThenWithdraw() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB STAND 41A CLSD 0800-1200\",\"mode\":\"preview\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(false))
                .andExpect(jsonPath("$.notice.standIds[0]").value("41A"));
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB STAND 41A CLSD 0800-1200\",\"mode\":\"apply\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applied").value(true))
                .andExpect(jsonPath("$.plan.closures.length()").value(greaterThan(5)));
        mvc.perform(delete("/api/plan/" + id + "/notices/N25")).andExpect(status().isOk());
        mvc.perform(delete("/api/plan/" + id + "/notices/N99")).andExpect(status().isNotFound());
    }

    @Test
    void badNoticesGetClearMessages() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB STAND 999 CLSD\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Stand 999 not found"));
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB STAND 41A CLSD 1800-1400\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void runwayNoticeIsFlagged() throws Exception {
        String id = ApiTestSupport.newPlan(mvc);
        mvc.perform(post("/api/plan/" + id + "/notices").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"VABB RWY 14/32 CLSD 0100-0300\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.notice.inModel").value(false));
    }

    @Test
    void suffixTreeSearch() throws Exception {
        mvc.perform(get("/api/notices/search?q=STAND")).andExpect(status().isOk())
                .andExpect(jsonPath("$.hits.length()").value(greaterThan(5)));
        mvc.perform(get("/api/notices/search").param("q", " ")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/notices")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(24));
    }
}
