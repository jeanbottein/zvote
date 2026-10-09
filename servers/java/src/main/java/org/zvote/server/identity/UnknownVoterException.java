package org.zvote.server.identity;

/**
 * A bearer token the server could not have issued.
 *
 * A cookie like that is replaced in silence, because a browser carrying a
 * stale one should simply start again. A bearer token is different: a client
 * chose to send it, and silently becoming a stranger would let an agent cast
 * ballots as a voter it does not know it is, with no way to notice. So this
 * answers 401 instead.
 */
public class UnknownVoterException extends RuntimeException {

    public UnknownVoterException(String message) {
        super(message);
    }
}
