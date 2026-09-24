package org.zvote.server.polls;

/** The poll no longer accepts ballots. */
public class PollClosedException extends RuntimeException {

    public PollClosedException() {
        super("Poll is closed");
    }
}
