package com.gateplanner.api;

import com.gateplanner.engine.StoryEngine;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** The arrival at the end of the story flight: one storm, solved the usual way and by the planner. */
@RestController
@RequestMapping("/api/story")
public class StoryController {

    private final StoryEngine story;

    public StoryController(StoryEngine story) {
        this.story = story;
    }

    @GetMapping("/arrival")
    public Map<String, Object> arrival(@RequestParam(defaultValue = "1") int day) {
        return story.arrival(day == 2 ? 2 : 1);
    }
}
