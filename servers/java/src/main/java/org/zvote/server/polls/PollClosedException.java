package org.zvote.server.polls;

/** The poll is closed for good: it takes no more ballots and cannot be reopened. Its message is for people. */
public class PollClosedException extends RuntimeException {

    static PollClosedException toBallots() {
        return new PollClosedException("This poll is closed and no longer accepts ballots.");
    }

    static PollClosedException forGood() {
        return new PollClosedException("A closed poll stays closed: its results are final.");
    }

    private PollClosedException(String message) {
        super(message);
    }
}
