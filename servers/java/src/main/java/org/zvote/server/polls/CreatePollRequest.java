package org.zvote.server.polls;

import java.util.List;

/**
 * A new poll. Every field is required but invitationOnly and showVoterNames
 * (false when left out), resultsShown (when left out: live unless the poll
 * shows names or takes invitations) and resultsAfterBallots (AFTER_BALLOTS
 * only); PollService says what is wrong and why.
 */
public record CreatePollRequest(
    String title,
    List<String> options,
    Poll.VotingSystem votingSystem,
    Poll.Visibility visibility,
    Boolean invitationOnly,
    Boolean showVoterNames,
    Poll.ResultsShown resultsShown,
    Long resultsAfterBallots
) {}
