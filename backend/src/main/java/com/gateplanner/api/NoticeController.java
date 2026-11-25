package com.gateplanner.api;

import com.gateplanner.engine.NoticeEngine;
import com.gateplanner.engine.NoticeService;
import com.gateplanner.engine.PlanService;
import com.gateplanner.model.Notice;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Notice validation, preview, apply, withdraw and suffix tree search. */
@RestController
@RequestMapping("/api")
public class NoticeController {

    public record NoticeRequest(@NotBlank String text, String mode) {
    }

    private final NoticeService notices;
    private final PlanService plans;

    public NoticeController(NoticeService notices, PlanService plans) {
        this.notices = notices;
        this.plans = plans;
    }

    @PostMapping("/plan/{id}/notices")
    public Map<String, Object> submit(@PathVariable String id, @Valid @RequestBody NoticeRequest req) {
        String mode = req.mode() == null ? "preview" : req.mode();
        Map<String, Object> out = new LinkedHashMap<>(notices.submit(id, req.text(), mode));
        Object op = out.remove("operation");
        if (op instanceof PlanService.Operation operation) {
            out.put("plan", PlanView.of(operation));
        }
        return out;
    }

    @DeleteMapping("/plan/{id}/notices/{noticeId}")
    public PlanView withdraw(@PathVariable String id, @PathVariable String noticeId) {
        return PlanView.of(notices.withdraw(id, noticeId));
    }

    @GetMapping("/plan/{id}/notices/search")
    public NoticeEngine.SearchOutcome searchPlan(@PathVariable String id, @RequestParam String q) {
        return notices.search(id, q);
    }

    /** Search the published sample notices (no plan needed). */
    @GetMapping("/notices/search")
    public NoticeEngine.SearchOutcome search(@RequestParam String q) {
        NoticeEngine engine = plans.noticeEngine();
        return engine.search(engine.index(baseNotices()), q);
    }

    @GetMapping("/notices")
    public List<Notice> list() {
        return baseNotices();
    }

    private List<Notice> baseNotices() {
        List<Notice> out = new ArrayList<>();
        int n = 1;
        for (String raw : plans.data().baseNotices()) {
            out.add(plans.noticeEngine().parse(String.format("N%02d", n++), raw));
        }
        return out;
    }
}
