package org.zvote.server.polls;

/** No poll has that share token, or it has been deleted. */
public class PollNotFoundException extends RuntimeException {

    public PollNotFoundException() {
        super("Poll not found");
    }
}
