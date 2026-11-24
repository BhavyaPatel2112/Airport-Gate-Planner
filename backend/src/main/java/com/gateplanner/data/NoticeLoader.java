package com.gateplanner.data;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.List;

/** Reads {@code notices.txt}: one notice per line, blank lines and lines starting with # ignored. */
public final class NoticeLoader {

    private NoticeLoader() {
    }

    public static List<String> load(Reader reader) throws IOException {
        List<String> out = new ArrayList<>();
        try (BufferedReader in = new BufferedReader(reader)) {
            String line;
            while ((line = in.readLine()) != null) {
                String t = line.trim();
                if (!t.isEmpty() && !t.startsWith("#")) {
                    out.add(t);
                }
            }
        }
        return out;
    }
}
