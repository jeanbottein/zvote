package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

/**
 * One of the choices on a poll. Options are fixed once the poll is created, so
 * ballots can safely refer to them by id.
 *
 * An aggregate of its own rather than a list inside Poll: Spring Data JDBC
 * deletes and re-inserts an aggregate's lists on every save, so closing a poll
 * would renumber its options and, through ON DELETE CASCADE, drop its ballots.
 */
public record PollOption(
    @Id Long id,
    Long pollId,
    int position,
    String label
) {}
