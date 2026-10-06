package org.zvote.server.api;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.zvote.server.live.PollStream;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollService;

/**
 * Deletes polls once their lifetime is over (zvote.limits.poll-lifetime-days),
 * every hour, and tells anyone still watching one. Tests turn it off
 * (zvote.retention-cron: "-"), so it never runs in the middle of one.
 */
@Component
class PollRetention {

    private final PollService polls;
    private final PollStream stream;

    PollRetention(PollService polls, PollStream stream) {
        this.polls = polls;
        this.stream = stream;
    }

    @Scheduled(cron = "${zvote.retention-cron:0 7 * * * *}")
    void deleteExpiredPolls() {
        polls.deleteExpired().stream().map(Poll::id).forEach(stream::deleted);
    }
}
