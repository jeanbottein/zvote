package org.zvote.server.polls;

/**
 * An invitation as its poll's creator sees it: its number, the token its link
 * carries, whom it is for (null if they did not say), and whether someone
 * voted with it. Never with which ballot.
 */
public record Invitation(long number, String token, String label, boolean used) {}
