package org.zvote.server.polls;

/** Only invited people may vote on this poll, and the voter brought no valid invitation. Its message is for people. */
public class NotInvitedException extends RuntimeException {

    NotInvitedException(String message) {
        super(message);
    }
}
