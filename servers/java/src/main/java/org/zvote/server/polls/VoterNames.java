package org.zvote.server.polls;

import java.util.List;

/**
 * The names shown on a poll: the first ones in alphabetical order, and whether
 * more voters gave one.
 */
public record VoterNames(List<String> names, boolean more) {}
