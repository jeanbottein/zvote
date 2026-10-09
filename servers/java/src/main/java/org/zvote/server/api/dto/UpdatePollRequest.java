package org.zvote.server.api.dto;

/** A change to a poll by its creator. Closing, for good, is the only change there is. */
public record UpdatePollRequest(Boolean closed) {}
