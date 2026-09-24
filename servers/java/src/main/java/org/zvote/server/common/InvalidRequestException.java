package org.zvote.server.common;

/**
 * A request that breaks one of the rules. The message is written for the person
 * using the app and is returned to them as is.
 */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
