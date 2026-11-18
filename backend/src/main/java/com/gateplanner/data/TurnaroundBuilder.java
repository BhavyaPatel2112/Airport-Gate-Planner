package com.gateplanner.data;

import com.gateplanner.model.Flight;
import com.gateplanner.model.MovementType;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Turnaround;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Turns flights into stand visits. An arrival followed by a departure of the same registration
 * within 25 minutes to 10 hours (by scheduled time, same terminal) becomes one visit. Every other
 * flight gets a standard turnaround: 45 minutes narrow-body, 90 minutes wide-body.
 */
public final class TurnaroundBuilder {

    public static final int MIN_PAIR_GAP = 25;
    public static final int MAX_PAIR_GAP = 600;
    private static final int MIN_VISIT = 20;

    private TurnaroundBuilder() {
    }

    public static List<Turnaround> build(List<Flight> flights) {
        Map<String, List<Flight>> byReg = new LinkedHashMap<>();
        List<Flight> unpaired = new ArrayList<>();
        for (Flight f : flights) {
            if (f.getRegistration() == null || f.getRegistration().isBlank()) {
                unpaired.add(f);
            } else {
                byReg.computeIfAbsent(f.getRegistration(), k -> new ArrayList<>()).add(f);
            }
        }
        List<Turnaround> result = new ArrayList<>();
        Set<String> usedIds = new HashSet<>();
        for (List<Flight> list : byReg.values()) {
            // insertion sort by scheduled time: lists are tiny (a few flights per aircraft per day)
            for (int i = 1; i < list.size(); i++) {
                Flight cur = list.get(i);
                int j = i - 1;
                while (j >= 0 && list.get(j).getScheduledMin() > cur.getScheduledMin()) {
                    list.set(j + 1, list.get(j));
                    j--;
                }
                list.set(j + 1, cur);
            }
            int i = 0;
            while (i < list.size()) {
                Flight a = list.get(i);
                if (a.getType() == MovementType.ARR && i + 1 < list.size()) {
                    Flight d = list.get(i + 1);
                    int gap = d.getScheduledMin() - a.getScheduledMin();
                    if (d.getType() == MovementType.DEP && gap >= MIN_PAIR_GAP && gap <= MAX_PAIR_GAP
                            && a.getTerminal().equals(d.getTerminal()) && a.isCancelled() == d.isCancelled()) {
                        result.add(paired(a, d, usedIds));
                        i += 2;
                        continue;
                    }
                }
                unpaired.add(a);
                i++;
            }
        }
        for (Flight f : unpaired) {
            result.add(single(f, usedIds));
        }
        return result;
    }

    private static Turnaround paired(Flight a, Flight d, Set<String> usedIds) {
        SizeClass size = a.getSize() == SizeClass.WIDE || d.getSize() == SizeClass.WIDE ? SizeClass.WIDE : SizeClass.NARROW;
        boolean intl = a.isInternational() || d.isInternational();
        int ss = Math.max(0, a.getScheduledMin());
        int se = Math.max(ss + MIN_VISIT, d.getScheduledMin());
        int as = Math.max(0, a.getActualMin());
        int ae = Math.max(as + MIN_VISIT, d.getActualMin());
        return new Turnaround(uniqueId(a.getKey(), usedIds), a, d, size, intl, d.getTerminal(), d.getAirlineCode(),
                d.getAirline(), d.getRegistration(), true, false, ss, se, as, ae);
    }

    private static Turnaround single(Flight f, Set<String> usedIds) {
        int turn = f.getSize() == SizeClass.WIDE ? Turnaround.WIDE_TURN : Turnaround.NARROW_TURN;
        int ss;
        int as;
        if (f.getType() == MovementType.ARR) {
            ss = Math.max(0, f.getScheduledMin());
            as = Math.max(0, f.getActualMin());
        } else {
            ss = Math.max(0, f.getScheduledMin() - turn);
            as = Math.max(0, f.getActualMin() - turn);
        }
        int se = f.getType() == MovementType.ARR ? ss + turn : Math.max(ss + MIN_VISIT, f.getScheduledMin());
        int ae = f.getType() == MovementType.ARR ? as + turn : Math.max(as + MIN_VISIT, f.getActualMin());
        Flight arr = f.getType() == MovementType.ARR ? f : null;
        Flight dep = f.getType() == MovementType.DEP ? f : null;
        return new Turnaround(uniqueId(f.getKey(), usedIds), arr, dep, f.getSize(), f.isInternational(), f.getTerminal(),
                f.getAirlineCode(), f.getAirline(), f.getRegistration(), false, false, ss, se, as, ae);
    }

    private static String uniqueId(String base, Set<String> used) {
        String id = base;
        int n = 2;
        while (!used.add(id)) {
            id = base + "-" + n++;
        }
        return id;
    }

    /** Index from every flight key (for example AI2927) to its visit id, used by search and delay. */
    public static Map<String, String> flightIndex(List<Turnaround> visits) {
        Map<String, String> index = new HashMap<>();
        for (Turnaround t : visits) {
            if (t.getArrival() != null) {
                index.putIfAbsent(t.getArrival().getKey(), t.getId());
            }
            if (t.getDeparture() != null) {
                index.putIfAbsent(t.getDeparture().getKey(), t.getId());
            }
        }
        return index;
    }
}
