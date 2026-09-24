package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

/**
 * One of the choices on a poll. Options are fixed once the poll is created, so
 * ballots can safely refer to them by id.
 */
public record PollOption(
    @Id Long id,
    Long pollId,
    int position,
    String label
) {}
