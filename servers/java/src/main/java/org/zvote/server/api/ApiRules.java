package org.zvote.server.api;

/**
 * The rules of this API that no schema can state, written once.
 *
 * A machine client learns a request's shape from the OpenAPI document, but not
 * that an unrated option counts as Bad, or that closing a poll is final. These
 * sentences say so, and both the OpenAPI description and the MCP tools are
 * written from them, so the two can never drift apart.
 */
public final class ApiRules {

    private ApiRules() {}

    public static final String IDENTITY = """
        Every request is made by a voter. A browser is one through a cookie it
        is given on its first call. Any other client asks for a token of its own
        (POST /api/voters) and sends it as "Authorization: Bearer <token>" on
        every request afterwards: the same token is the same voter, and a token
        this server did not issue answers 401 rather than quietly becoming
        somebody new. Keep the token: it is what lets that voter revise their
        ballot, and what makes their polls theirs.""";

    public static final String IDEMPOTENCY = """
        POST /api/polls and POST /api/polls/{id}/invitations take an
        "Idempotency-Key" header. Send one, and repeating a request that may
        already have landed answers what the first one did rather than making a
        second poll, or handing a second link to the same person. Casting a
        ballot is a PUT and needs no key: it replaces the caller's ballot, so
        sending it twice changes nothing.""";

    public static final String BALLOTS = """
        A ballot is cast, revised and withdrawn by the same request: PUT
        replaces the caller's whole ballot, and an empty one withdraws it. Send
        "judgments" (one of Bad, Inadequate, Passable, Fair, Good, VeryGood,
        Excellent per option id) on a majority judgment poll, or
        "approvedOptionIds" on an approval poll. On a majority judgment poll,
        an option left out counts as Bad: every ballot grades every option.""";

    public static final String INVITATIONS = """
        A poll created with "invitationOnly": true is voted on by its creator
        and by invited people only. Its creator makes invitations - one per
        name in "labels", or "count" anonymous ones - and sends each person the
        "link" that comes back. A voter's client sends that invitation's token
        in the "Zvote-Invitation" header; the first ballot cast with it binds
        it to that voter, and nobody else can use it afterwards. The creator
        sees which invitations were used, never what anyone chose.""";

    public static final String RESULTS = """
        Results carry the counts and the ranking the server derives from them:
        rank 1 is the winner, and a rank shared by several options means they
        are ex aequo. On a majority judgment poll each option also carries the
        majority mention that ranks it and the score that separates options
        sharing one. A poll may keep its results back until a number of ballots
        are in, or until it closes: then every count and every rank is null,
        for everyone including its creator, and only the number of ballots
        shows. GET /api/polls/{id}/results is the same answer for everyone and
        can be asked for repeatedly; the event stream pushes it instead.""";

    public static final String CLOSING = """
        Closing a poll is final: a closed poll takes no more ballots and cannot
        be reopened. Polls are deleted, with their ballots, pollLifetimeDays
        after they were created.""";

    public static final String HANDOVER = """
        A client creating a poll for somebody else sends "handover": true, and
        the answer carries a one-time token. Whoever sends it back to POST
        /api/polls/{id}/creator becomes the poll's creator - the poll is then
        theirs to close, to delete, and whose invitations are theirs to read -
        and the token is spent.""";

    public static final String ERRORS = """
        Every error is an RFC 9457 problem document. Its "type" says what went
        wrong and is what to branch on (/problems/poll-closed,
        /problems/not-invited, /problems/invitation-used,
        /problems/poll-not-found, /problems/not-poll-creator,
        /problems/unknown-voter, /problems/handover-unavailable,
        /problems/invalid-request, /problems/collision, /problems/server-error);
        its "detail" is a sentence written for a person to read. A collision
        answers 409 with Retry-After: sending the request again is safe.""";
}
