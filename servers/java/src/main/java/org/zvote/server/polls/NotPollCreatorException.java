package org.zvote.server.polls;

/** Only the poll's creator may close or delete it. */
public class NotPollCreatorException extends RuntimeException {

    public NotPollCreatorException() {
        super("Not the poll's creator");
    }
}
