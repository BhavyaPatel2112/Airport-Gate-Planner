package com.gateplanner.data;

import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.Reader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Loads the stand list ({@code stands.csv}) and validates it. */
public final class StandLoader {

    public static final String HEADER = "stand,terminal,size,contact,international,x,y,taxiway,group,source";

    private StandLoader() {
    }

    public static List<Stand> load(Reader reader) throws IOException {
        List<Stand> stands = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        try (BufferedReader in = new BufferedReader(reader)) {
            String header = in.readLine();
            if (header == null || !header.trim().equals(HEADER)) {
                throw new DataFormatException("Stand file must start with: " + HEADER, 1);
            }
            String line;
            int lineNo = 1;
            while ((line = in.readLine()) != null) {
                lineNo++;
                if (line.isBlank()) {
                    continue;
                }
                String[] c = line.split(",", -1);
                if (c.length != 10) {
                    throw new DataFormatException("Expected 10 columns", lineNo);
                }
                String id = c[0].trim().toUpperCase();
                if (!ids.add(id)) {
                    throw new DataFormatException("Duplicate stand " + id, lineNo);
                }
                try {
                    stands.add(new Stand(id, c[1].trim(), SizeClass.valueOf(c[2].trim()),
                            Boolean.parseBoolean(c[3].trim()), Boolean.parseBoolean(c[4].trim()),
                            Double.parseDouble(c[5]), Double.parseDouble(c[6]), c[7].trim().toUpperCase(),
                            c[8].trim(), c[9].trim()));
                } catch (IllegalArgumentException e) {
                    throw new DataFormatException("Bad value in stand row: " + e.getMessage(), lineNo);
                }
            }
        }
        if (stands.isEmpty()) {
            throw new DataFormatException("Stand file has no stands", 2);
        }
        return stands;
    }
}
