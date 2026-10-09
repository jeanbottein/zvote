package org.zvote.server.api;

import java.net.URI;

/**
 * What went wrong, for a machine.
 *
 * A problem document's "detail" is a sentence for the person using the app, so
 * it is free to change, be translated, or name a number; its "type" is the
 * contract. A client - an agent above all - branches on this, rather than
 * reading English. The URIs are relative, which RFC 9457 resolves against the
 * request, so they hold whatever address this server answers on.
 *
 * Every failure the server raises itself has one. Spring MVC's own refusals
 * (405, 415, a route that does not exist) keep the default, about:blank.
 */
enum ProblemType {

    /** The request breaks a rule; the detail says which. */
    INVALID_REQUEST("invalid-request"),

    /** A voter token this server could not have issued. */
    UNKNOWN_VOTER("unknown-voter"),

    /** Only the poll's creator may do that. */
    NOT_POLL_CREATOR("not-poll-creator"),

    /** This poll takes invitations, and the caller brought none that works. */
    NOT_INVITED("not-invited"),

    /** That handover token is spent, or not this poll's. */
    HANDOVER_UNAVAILABLE("handover-unavailable"),

    /** No poll has that id or join code, or it was deleted. */
    POLL_NOT_FOUND("poll-not-found"),

    /** The poll is closed, for good. */
    POLL_CLOSED("poll-closed"),

    /** That invitation has voted already, in another browser or on another device. */
    INVITATION_USED("invitation-used"),

    /** Another change landed at the same moment. Sending it again is safe. */
    COLLISION("collision"),

    /** A bug, or the database away. */
    SERVER_ERROR("server-error");

    private final URI uri;

    ProblemType(String slug) {
        this.uri = URI.create("/problems/" + slug);
    }

    URI uri() {
        return uri;
    }
}
