package org.supervote.server.api;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.supervote.server.statistics.Statistics;
import org.supervote.server.statistics.StatisticsService;

import java.time.Duration;

/**
 * How much super-vote is used, and where, for everyone to see. The answer changes
 * once an hour, so anything in between may serve it from a cache.
 */
@RestController
public class StatisticsController {

    private static final CacheControl FIVE_MINUTES = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

    private final StatisticsService statistics;

    StatisticsController(StatisticsService statistics) {
        this.statistics = statistics;
    }

    @GetMapping("/api/statistics")
    public ResponseEntity<Statistics> statistics() {
        return ResponseEntity.ok().cacheControl(FIVE_MINUTES).body(statistics.current());
    }
}
