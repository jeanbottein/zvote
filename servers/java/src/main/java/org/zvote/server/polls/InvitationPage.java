package org.zvote.server.polls;

import java.util.List;

/**
 * Some of a poll's invitations, newest first. count: how many its creator
 * made and did not take back. next: what to ask for as "before" to read on,
 * or null once the first invitation is in.
 */
public record InvitationPage(long count, List<Invitation> invitations, Long next) {}
