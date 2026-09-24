package org.zvote.server.polls.dto;

import org.zvote.server.polls.Poll;

import java.util.List;

/** A new poll. Every field is required; PollService says what is wrong and why. */
public record CreatePollRequest(
    String title,
    List<String> options,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility
) {}
