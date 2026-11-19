package com.gateplanner.api;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Shared helpers for API tests. */
final class ApiTestSupport {

    private ApiTestSupport() {
    }

    /** Builds a Day 1 plan and returns its id. */
    static String newPlan(MockMvc mvc) throws Exception {
        MvcResult r = mvc.perform(post("/api/plan").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"day\":1,\"bufferPercentile\":90}"))
                .andExpect(status().isOk()).andReturn();
        String body = r.getResponse().getContentAsString();
        int i = body.indexOf("\"planId\":\"") + 10;
        return body.substring(i, body.indexOf('"', i));
    }
}
