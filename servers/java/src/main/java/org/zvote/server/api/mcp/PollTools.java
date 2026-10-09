package org.zvote.server.api.mcp;

import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.aot.hint.annotation.RegisterReflectionForBinding;
import org.springframework.stereotype.Component;
import org.zvote.server.api.ApiRules;
import org.zvote.server.api.PollChangeService;
import org.zvote.server.api.PollCreationService;
import org.zvote.server.api.PollViewService;
import org.zvote.server.api.dto.CastBallotRequest;
import org.zvote.server.api.dto.OptionView;
import org.zvote.server.api.dto.PollSummary;
import org.zvote.server.api.dto.PollView;
import org.zvote.server.polls.CreatePollRequest;
import org.zvote.server.polls.InvitationPage;
import org.zvote.server.polls.InvitationService;
import org.zvote.server.polls.Poll;
import org.zvote.server.polls.PollNotFoundException;
import org.zvote.server.polls.PollService;

import java.util.List;
import java.util.Map;

/**
 * zvote as tools, for an agent: running a vote among people, or among agents
 * deciding together.
 *
 * The same services the HTTP API calls, so there is one set of rules and no
 * second contract to keep in step. The descriptions are written from
 * {@link ApiRules}, which the OpenAPI document is written from too.
 */
@Component
// Decision is answered by a tool and named in no controller's signature, so a
// native image would not know how to read its record components (see CLAUDE.md).
// Every other answer here is a shape the HTTP API already returns.
@RegisterReflectionForBinding(Decision.class)
public class PollTools {

    private final PollService polls;
    private final PollCreationService creations;
    private final PollChangeService changes;
    private final PollViewService views;
    private final InvitationService invitations;
    private final CallingVoter caller;

    PollTools(PollService polls, PollCreationService creations, PollChangeService changes, PollViewService views,
              InvitationService invitations, CallingVoter caller) {
        this.polls = polls;
        this.creations = creations;
        this.changes = changes;
        this.views = views;
        this.invitations = invitations;
        this.caller = caller;
    }

    @McpTool(name = "create_poll", title = "Create a poll", description = """
        Asks a question, with the options to decide between. Answers the poll,
        whose "id" opens it and identifies it everywhere else, and whose
        "joinCode" is a short stand-in to type.

        Majority judgment asks every voter to grade every option (Bad,
        Inadequate, Passable, Fair, Good, VeryGood, Excellent) and is the
        better choice when the options are not simply acceptable or not;
        approval asks only which options each voter would accept. Leave the
        voting system out for majority judgment.

        Set invitationOnly to count each voter once, then invite people with
        the "invite" tool and send each the link it answers. Set handover to
        true when the poll is for somebody else: the answer then carries a
        one-time token, and whoever opens /p/{id}#handover={token} becomes the
        poll's creator.""")
    public PollView createPoll(
        @McpToolParam(description = "The question being decided.", required = true) String title,
        @McpToolParam(description = "What to decide between: 2 to 20, each one distinct.", required = true)
        List<String> options,
        @McpToolParam(description = "MAJORITY_JUDGMENT (the default) or APPROVAL.", required = false)
        Poll.VotingSystem votingSystem,
        @McpToolParam(description = "Only invited people may vote. Default false.", required = false)
        Boolean invitationOnly,
        @McpToolParam(description = "Voters may give a name, shown to everyone on the poll. Default false.",
            required = false) Boolean showVoterNames,
        @McpToolParam(description = """
            When results show while the poll is open: LIVE, AFTER_BALLOTS (with
            resultsAfterBallots, 3 at least) or AFTER_CLOSING. Left out: LIVE,
            or AFTER_CLOSING if the poll shows names or takes invitations,
            since a name appearing as a ballot lands shows who chose what.""",
            required = false) Poll.ResultsShown resultsShown,
        @McpToolParam(description = "With AFTER_BALLOTS: how many ballots before results show.", required = false)
        Long resultsAfterBallots,
        @McpToolParam(description = "Answer a one-time token that hands the poll to its person.", required = false)
        Boolean handover) {
        var voter = caller.get();
        var request = new CreatePollRequest(title, options,
            votingSystem == null ? Poll.VotingSystem.MAJORITY_JUDGMENT : votingSystem,
            Poll.Visibility.UNLISTED, invitationOnly, showVoterNames, resultsShown, resultsAfterBallots, handover);
        var poll = creations.create(request, voter.id());
        return views.view(poll, voter, null, polls.handoverTokenOf(poll, voter.id()).orElse(null));
    }

    @McpTool(name = "read_poll", title = "Read a poll", description = """
        The poll as the calling voter sees it: its question and options with
        their ids, whether this voter created it, whether they may vote on it
        ("admission"), their own ballot if they have cast one, and the results
        if the poll is showing them.""")
    public PollView readPoll(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll,
        @McpToolParam(description = "An invitation token, for a poll that takes invitations.", required = false)
        String invitation) {
        var voter = caller.get();
        return views.view(found(poll), voter, invitation);
    }

    @McpTool(name = "poll_results", title = "Read a poll's results", description = """
        The counts, the ranking and the winner: the options at rank 1, which is
        several of them when they are ex aequo. The same answer for everyone,
        so it can be asked for again as ballots arrive.

        A poll keeping its results back answers no counts and no winner, for
        anyone including its creator: only the number of ballots. Closing it
        shows them.""")
    public Decision pollResults(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll) {
        var results = views.results(found(poll).shareToken());
        var winner = results.options().stream()
            .filter(option -> Integer.valueOf(1).equals(option.rank()))
            .map(OptionView::label)
            .toList();
        return new Decision(winner, results);
    }

    @McpTool(name = "cast_ballot", title = "Cast a ballot", description = """
        Casts, revises or withdraws the calling voter's ballot: it replaces
        whatever they had, so sending it again is safe, and an empty one
        withdraws.

        On a majority judgment poll send "judgments", a mention per option id
        (Bad, Inadequate, Passable, Fair, Good, VeryGood, Excellent): an option
        left out counts as Bad, so grade every one of them. On an approval poll
        send "approvedOptionIds" instead. Option ids come from read_poll.

        On a poll that takes invitations, pass the token from the invitation
        link. The first ballot cast with it binds it to this voter, and nobody
        else can vote with it afterwards.""")
    public PollView castBallot(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll,
        @McpToolParam(description = "Majority judgment: option id to mention. Empty to withdraw.", required = false)
        Map<String, String> judgments,
        @McpToolParam(description = "Approval: the option ids approved. Empty to withdraw.", required = false)
        List<String> approvedOptionIds,
        @McpToolParam(description = "A name to show, on a poll that shows names.", required = false) String voterName,
        @McpToolParam(description = "An invitation token, for a poll that takes invitations.", required = false)
        String invitation) {
        var voter = caller.get();
        var ballot = new CastBallotRequest(approvedOptionIds, judgments, voterName);
        return views.view(changes.cast(found(poll).shareToken(), ballot, voter, invitation), voter, invitation);
    }

    @McpTool(name = "invite", title = "Invite people to a poll", description = """
        Makes invitations to a poll that takes them, and answers each with the
        "link" to send its person - that link, and nothing else, is what lets
        them vote once.

        Name them ("labels", a hundred at a time at most) to see later which of
        them have voted, never what they chose; or ask for a "count" of
        anonymous ones. Its creator only, while the poll is open.""")
    public InvitationPage invite(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll,
        @McpToolParam(description = "One name per invitation, as the creator will recognise them.", required = false)
        List<String> labels,
        @McpToolParam(description = "How many anonymous invitations to make instead.", required = false) Long count) {
        var voter = caller.get();
        var id = found(poll).shareToken();
        invitations.invite(id, voter.id(), labels, count);
        return invitations.invitationsOf(id, voter.id(), null, null);
    }

    @McpTool(name = "list_invitations", title = "List a poll's invitations", description = """
        The newest invitations to a poll, with their links and whether someone
        has voted with each - never with which ballot. Its creator only.""")
    public InvitationPage listInvitations(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll,
        @McpToolParam(description = "Read on below this number, from the previous answer's \"next\".",
            required = false) Long before) {
        return invitations.invitationsOf(found(poll).shareToken(), caller.get().id(), before, null);
    }

    @McpTool(name = "close_poll", title = "Close a poll", description = """
        Closes a poll for good: it takes no more ballots, its results show, and
        it cannot be reopened. Its creator only.""")
    public PollView closePoll(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll) {
        var voter = caller.get();
        return views.view(changes.close(found(poll).shareToken(), voter.id()), voter, null);
    }

    @McpTool(name = "delete_poll", title = "Delete a poll", description = """
        Deletes a poll and its ballots, now rather than when its lifetime ends.
        Its creator only, and it cannot be undone.""")
    public String deletePoll(
        @McpToolParam(description = "The poll's id, or its join code.", required = true) String poll) {
        changes.delete(found(poll).shareToken(), caller.get().id());
        return "Deleted, with its ballots.";
    }

    @McpTool(name = "list_my_polls", title = "List the polls this voter created", description = """
        The polls the calling voter created, newest first, a hundred at most.""")
    public List<PollSummary> listMyPolls() {
        var voter = caller.get();
        return polls.listCreatedBy(voter.id()).stream().map(poll -> views.summary(poll, voter)).toList();
    }

    /** A poll by its id or, failing that, by its join code: an agent is given either. */
    private Poll found(String poll) {
        try {
            return polls.find(poll);
        } catch (PollNotFoundException notAnId) {
            return polls.findByJoinCode(poll);
        }
    }
}
