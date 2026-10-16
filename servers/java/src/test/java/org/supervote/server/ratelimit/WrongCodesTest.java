package org.supervote.server.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.assertj.core.api.Assertions.assertThatNoException;

class WrongCodesTest {

    final WrongCodes wrongCodes = new WrongCodes(new RateLimits(20, 5, 20));
    final Network classroom = Network.of("203.0.113.7");

    @Test
    void wrongCodesInARowBarTheNetworkForADay() {
        wrong(4);
        assertThatNoException().isThrownBy(() -> wrongCodes.check(classroom));

        wrong(1);

        assertThatExceptionOfType(TooManyWrongCodesException.class)
            .isThrownBy(() -> wrongCodes.check(classroom))
            .satisfies(refused -> assertThat(refused.retryAfter()).isBetween(Duration.ofHours(23), Duration.ofDays(1)))
            .withMessageContaining("refused for the next 24 hours, but links to polls still work.");
    }

    /** A room sharing one connection, where a few people mistype the code on the screen. */
    @Test
    void aRightCodeEndsARunOfWrongOnes() {
        wrong(4);
        wrongCodes.right(classroom);
        wrong(4);

        assertThatNoException().isThrownBy(() -> wrongCodes.check(classroom));
    }

    /** A guesser slipping a right code in between still runs out. */
    @Test
    void wrongCodesAddUpOverTheDay() {
        for (int run = 0; run < 5; run++) {
            wrong(4);
            wrongCodes.right(classroom);
        }

        assertThatExceptionOfType(TooManyWrongCodesException.class).isThrownBy(() -> wrongCodes.check(classroom));
    }

    @Test
    void oneNetworksWrongCodesAreNotAnothers() {
        wrong(5);

        assertThatNoException().isThrownBy(() -> wrongCodes.check(Network.of("198.51.100.4")));
    }

    @Test
    void aBarLiftsAfterADayAndTheNetworkStartsAfresh() {
        var earned = Instant.parse("2026-10-16T08:00:00Z");
        var barred = WrongCodes.Tries.none(earned).wrong(earned).bar(earned.plus(Duration.ofDays(1)));
        var dayAfter = earned.plus(Duration.ofDays(1));

        assertThat(barred.barredAt(dayAfter.minusSeconds(1))).isTrue();
        assertThat(barred.barredAt(dayAfter)).isFalse();
        assertThat(barred.wrong(dayAfter).today().count()).isEqualTo(1);
        assertThat(barred.wrong(dayAfter).inARow()).isEqualTo(1);
    }

    @Test
    void aNetworkIsForgottenOnceItsDayIsOverUnlessItIsBarred() {
        var start = Instant.parse("2026-10-16T08:00:00Z");
        var tried = WrongCodes.Tries.none(start).wrong(start);
        var dayAfter = start.plus(Duration.ofDays(1));

        assertThat(tried.isPast(dayAfter.minusSeconds(1))).isFalse();
        assertThat(tried.isPast(dayAfter)).isTrue();
        assertThat(tried.bar(dayAfter.plusSeconds(60)).isPast(dayAfter)).isFalse();
    }

    private void wrong(int times) {
        for (int i = 0; i < times; i++) {
            wrongCodes.wrong(classroom);
        }
    }
}
