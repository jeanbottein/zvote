package org.zvote.server.polls;

/**
 * A handover token that is not this poll's, or was spent already. One
 * handover per poll, and only the first to arrive.
 */
public class HandoverUnavailableException extends RuntimeException {

    public HandoverUnavailableException(String message) {
        super(message);
    }
}
