package org.zvote.server.api.dto;

import org.zvote.server.polls.Admission;
import org.zvote.server.polls.Poll;

import java.time.Instant;
import java.util.List;

/**
 * A poll as one particular voter sees it: its results, whether they created
 * it, whether they may vote on it, and their own ballot (null until they
 * vote).
 *
 * The id is the share token - the only identifier that leaves the server. The
 * join code is its short stand-in, to type on a phone. While resultsShown
 * keeps them back, the options carry no tallies.
 *
 * handover is the token that makes its bearer the poll's creator, for a client
 * that created the poll for somebody else and now sends it to them. It is only
 * ever answered by the request that created the poll, and only when that
 * request asked for it: null everywhere else, this being a credential.
 */
public record PollView(
    String id,
    String joinCode,
    String title,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    boolean invitationOnly,
    boolean showVoterNames,
    Poll.ResultsShown resultsShown,
    Long resultsAfterBallots,
    Instant createdAt,
    Instant closedAt,
    Instant expiresAt,
    boolean isMine,
    Admission admission,
    long totalBallots,
    List<OptionView> options,
    List<String> voterNames,
    boolean moreVoterNames,
    MyBallotView myBallot,
    String handover
) {}
