package org.zvote.server.api.dto;

/**
 * New invitations: count of them (1 when left out), anonymous, or a single
 * one with a label saying whom it is for, as a name or a nickname.
 */
public record CreateInvitationsRequest(String label, Long count) {}
