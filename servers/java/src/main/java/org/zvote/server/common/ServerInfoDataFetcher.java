package org.zvote.server.common;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.zvote.server.common.dto.FeatureFlags;
import org.zvote.server.common.dto.ServerInfo;

@DgsComponent
@RequiredArgsConstructor
@EnableConfigurationProperties(ZVoteProperties.class)
public class ServerInfoDataFetcher {

    private final ZVoteProperties properties;

    @DgsQuery
    public ServerInfo serverInfo() {
        return ServerInfo.builder()
            .maxOptions(properties.limits().maxOptions())
            .features(FeatureFlags.builder()
                .publicVotes(properties.features().publicVotes())
                .unlistedVotes(properties.features().unlistedVotes())
                .privateVotes(properties.features().privateVotes())
                .approvalVoting(properties.features().approvalVoting())
                .majorityJudgment(properties.features().majorityJudgment())
                .ipLimiting(properties.features().ipLimiting())
                .liveBallot(properties.features().liveBallot())
                .envelopeBallot(properties.features().envelopeBallot())
                .build())
            .build();
    }
}
