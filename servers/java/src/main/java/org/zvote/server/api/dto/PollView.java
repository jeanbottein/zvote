package org.zvote.server.api.dto;

import org.zvote.server.polls.Poll;

import java.time.Instant;
import java.util.List;

/**
 * A poll as one particular voter sees it: its results, whether they created
 * it, and their own ballot (null until they vote).
 *
 * The id is the share token - the only identifier that leaves the server. The
 * join code is its short stand-in, to type on a phone. While resultsShown
 * keeps them back, the options carry no tallies.
 */
public record PollView(
    String id,
    String joinCode,
    String title,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    boolean showVoterNames,
    Poll.ResultsShown resultsShown,
    Integer resultsAfterBallots,
    Instant createdAt,
    Instant closedAt,
    Instant expiresAt,
    boolean isMine,
    long totalBallots,
    List<OptionView> options,
    List<String> voterNames,
    MyBallotView myBallot
) {}
