package org.zvote.server.api.dto;

import org.zvote.server.common.ZVoteProperties;

/** What this server offers, so a client can adapt its UI. */
public record ServerInfo(
    ZVoteProperties.Features features,
    ZVoteProperties.Limits limits
) {}
