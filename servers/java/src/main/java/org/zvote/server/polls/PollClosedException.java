package org.zvote.server.polls;

/** The poll is closed: it takes no more ballots. Its message is for people. */
public class PollClosedException extends RuntimeException {

    PollClosedException() {
        super("This poll is closed and no longer accepts ballots.");
    }
}
