package org.zvote.server.polls;

/**
 * A ballot was cast with this invitation: no other browser can use it, and it
 * cannot be taken back. Its message is for people.
 */
public class InvitationUsedException extends RuntimeException {

    InvitationUsedException(String message) {
        super(message);
    }
}
