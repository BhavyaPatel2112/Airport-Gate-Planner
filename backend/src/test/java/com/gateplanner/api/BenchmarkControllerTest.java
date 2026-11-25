package com.gateplanner.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class BenchmarkControllerTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void runsASmallSuite() throws Exception {
        mvc.perform(post("/api/bench/run").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"suite\":\"sort\",\"sizes\":[100,1000,5000]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.rows.length()").value(6));
        mvc.perform(get("/api/bench/suites")).andExpect(status().isOk());
    }

    @Test
    void unknownSuiteIs400() throws Exception {
        mvc.perform(post("/api/bench/run").contentType(MediaType.APPLICATION_JSON).content("{\"suite\":\"magic\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void exactSolverComparesWithOurs() throws Exception {
        mvc.perform(post("/api/exact").contentType(MediaType.APPLICATION_JSON).content("{\"flights\":8,\"seed\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bruteForce.cost").exists())
                .andExpect(jsonPath("$.gap").exists());
    }

    @Test
    void exactSolverRefusesLargeInputWith422() throws Exception {
        mvc.perform(post("/api/exact").contentType(MediaType.APPLICATION_JSON).content("{\"flights\":40}"))
                .andExpect(status().isUnprocessableContent()).andExpect(jsonPath("$.error").value("UNPROCESSABLE"));
    }
}
