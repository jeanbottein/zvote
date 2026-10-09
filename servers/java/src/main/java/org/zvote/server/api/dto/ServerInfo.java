package org.zvote.server.api.dto;

import org.zvote.server.common.ZVoteProperties;

/**
 * What this server offers, so a client can adapt its UI.
 *
 * publicUrl is where its polls are reached: a client that builds a share link
 * from its own address (a packaged app, an agent) uses this instead. Null when
 * the server was not told.
 */
public record ServerInfo(
    ZVoteProperties.Features features,
    ZVoteProperties.Limits limits,
    String publicUrl
) {}
