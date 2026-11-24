package com.gateplanner.engine;

import com.gateplanner.model.Notice;
import com.gateplanner.model.SizeClass;
import com.gateplanner.model.Stand;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NoticeEngineTest {

    private final NoticeEngine engine = new NoticeEngine(List.of(
            new Stand("42A", "T2", SizeClass.NARROW, true, false, 0, 0, "K", "G", "observed"),
            new Stand("51", "T2", SizeClass.NARROW, true, false, 0, 0, "N", "G", "observed"),
            new Stand("52", "T2", SizeClass.WIDE, true, false, 0, 0, "N", "G", "observed"),
            new Stand("142", "T2", SizeClass.NARROW, false, false, 0, 0, "W", "G", "assumed")));

    @Test
    void parsesStandClosureWithWindow() {
        Notice n = engine.parse("N1", "vabb stand 42A clsd 1400-1800");
        assertTrue(n.inModel());
        assertEquals(List.of("42A"), n.standIds());
        assertEquals(840, n.from());
        assertEquals(1080, n.to());
        assertEquals(1, NoticeEngine.closuresOf(n).size());
    }

    @Test
    void unknownStandIsRejected() {
        NoticeEngine.NoticeException e = assertThrows(NoticeEngine.NoticeException.class,
                () -> engine.parse("N1", "VABB STAND 999 CLSD"));
        assertEquals("Stand 999 not found", e.getMessage());
    }

    @Test
    void endBeforeStartIsRejected() {
        assertThrows(NoticeEngine.NoticeException.class, () -> engine.parse("N1", "VABB STAND 42A CLSD 1800-1400"));
        assertThrows(NoticeEngine.NoticeException.class, () -> engine.parse("N1", "VABB STAND 42A CLSD 2500-2600"));
        assertThrows(NoticeEngine.NoticeException.class, () -> engine.parse("N1", "EGLL STAND 42A CLSD"));
    }

    @Test
    void runwayClosureIsOutsideTheModel() {
        Notice n = engine.parse("N1", "VABB RWY 09/27 CLSD 0200-0400");
        assertFalse(n.inModel());
        assertTrue(n.note().contains("outside this model"));
        assertTrue(NoticeEngine.closuresOf(n).isEmpty());
    }

    @Test
    void rangesAndTaxiwaysExpandToStands() {
        assertEquals(List.of("51", "52"), engine.parse("N1", "VABB STANDS 51-55 CLSD WIP").standIds());
        assertEquals(List.of("51", "52"), engine.parse("N2", "VABB TWY N CLSD 0600-0900").standIds());
        assertThrows(NoticeEngine.NoticeException.class, () -> engine.parse("N3", "VABB TWY Q CLSD"));
    }

    @Test
    void suffixTreeFindsWholeStandIdsOnly() {
        List<Notice> notices = List.of(engine.parse("N1", "VABB STAND 42A CLSD 1400-1800"),
                engine.parse("N2", "VABB STAND 142 CLSD"));
        NoticeEngine.Index idx = engine.index(notices);
        Map<String, List<String>> m = engine.mentions(idx, List.of("42A", "142", "51"), new TraceRecorder());
        assertEquals(List.of("N1"), m.get("42A"));
        assertEquals(List.of("N2"), m.get("142"));
        assertFalse(m.containsKey("51"));
        assertEquals(2, engine.search(idx, "CLSD").hits().size());
    }
}
