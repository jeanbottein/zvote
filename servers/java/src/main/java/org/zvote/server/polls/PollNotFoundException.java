package org.zvote.server.polls;

/** No poll has that share token or join code, or it was deleted. Its message is for people. */
public class PollNotFoundException extends RuntimeException {

    PollNotFoundException() {
        this("That poll does not exist. The link may be mistyped, or the poll was deleted.");
    }

    PollNotFoundException(String message) {
        super(message);
    }
}
