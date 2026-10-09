package org.zvote.server.polls;

import java.util.List;

/**
 * A new poll. Every field is required but invitationOnly and showVoterNames
 * (false when left out), resultsShown (when left out: live unless the poll
 * shows names or takes invitations) and resultsAfterBallots (AFTER_BALLOTS
 * only); PollService says what is wrong and why.
 *
 * handover: answer with a one-time token that makes whoever brings it the
 * poll's creator. A client creating a poll for somebody else - an agent asked
 * to run a vote - sends the token to them, so that the poll is theirs to close
 * and whose invitations are theirs to read.
 */
public record CreatePollRequest(
    String title,
    List<String> options,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    Boolean invitationOnly,
    Boolean showVoterNames,
    Poll.ResultsShown resultsShown,
    Long resultsAfterBallots,
    Boolean handover
) {}
