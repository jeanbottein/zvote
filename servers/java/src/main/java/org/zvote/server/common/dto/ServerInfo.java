package org.zvote.server.common.dto;

import lombok.Builder;

@Builder
public record ServerInfo(
    int maxOptions,
    FeatureFlags features
) {}
