package org.zvote.server.polls;

/** The poll is closed: it takes no more ballots. Its message is for people. */
public class PollClosedException extends RuntimeException {

    PollClosedException() {
        this("This poll is closed and no longer accepts ballots.");
    }

    PollClosedException(String message) {
        super(message);
    }
}
