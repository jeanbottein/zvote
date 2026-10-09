package org.zvote.server.api.dto;

/** A voter token, for a client that keeps its own rather than a cookie. */
public record NewVoter(String token) {}
