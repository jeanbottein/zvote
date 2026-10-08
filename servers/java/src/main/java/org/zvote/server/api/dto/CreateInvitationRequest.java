package org.zvote.server.api.dto;

/** A new invitation. label: whom it is for, as a name or a nickname; left out or blank, it is anonymous. */
public record CreateInvitationRequest(String label) {}
