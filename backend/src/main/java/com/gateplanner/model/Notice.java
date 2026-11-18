package com.gateplanner.model;

import java.util.List;

/**
 * A parsed airport notice (NOTAM style), for example {@code VABB STAND 42A CLSD 1400-1800}.
 *
 * @param id         notice id, for example N07
 * @param text       normalised text of the notice
 * @param kind       STAND, TAXIWAY or RUNWAY
 * @param standIds   stands closed by this notice (for a taxiway, the stands it serves)
 * @param from       start minute of the closure
 * @param to         end minute of the closure (exclusive)
 * @param inModel    false for items outside this model, such as runway closures
 * @param note       plain English explanation shown in the teletype
 */
public record Notice(String id, String text, String kind, List<String> standIds, int from, int to,
                     boolean inModel, String note) {
}
