package org.supervote.server.ratelimit;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitedExceptionTest {

    /** Rounded up, so that whoever waits that long is not refused again for being early. */
    @ParameterizedTest(name = "{0} is {1}")
    @CsvSource({
        "PT0S, 1 minute",
        "PT30S, 1 minute",
        "PT1M1S, 2 minutes",
        "PT40M, 40 minutes",
        "PT59M30S, 1 hour",
        "PT1H, 1 hour",
        "PT1H0M1S, 2 hours",
        "PT23H59M, 24 hours",
    })
    void saysHowLongToWaitInWords(Duration wait, String words) {
        assertThat(RateLimitedException.inWords(wait)).isEqualTo(words);
    }
}
