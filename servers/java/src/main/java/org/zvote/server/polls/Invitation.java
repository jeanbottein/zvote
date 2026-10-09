package org.zvote.server.polls;

/**
 * An invitation as its poll's creator sees it: its number, the token its link
 * carries, the link itself, whom it is for (null if they did not say), and
 * whether someone voted with it. Never with which ballot.
 *
 * The link is the one thing to send its person, so a client never has to know
 * how one is put together - the token goes in the fragment, which browsers do
 * not send, so no log ever holds it. It is null when the server was not told
 * its public address (zvote.public-url).
 */
public record Invitation(long number, String token, String link, String label, boolean used) {}
