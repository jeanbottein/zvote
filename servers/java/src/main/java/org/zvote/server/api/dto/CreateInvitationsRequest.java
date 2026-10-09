package org.zvote.server.api.dto;

import java.util.List;

/**
 * Invitations to make: one per name in {@code labels} (a hundred at a time at
 * most), or {@code count} anonymous ones. Neither makes one. Both is refused:
 * an invitation is for a person or for nobody in particular.
 */
public record CreateInvitationsRequest(List<String> labels, Long count) {}
