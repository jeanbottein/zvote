package org.zvote.server.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.ServerInfo;
import org.zvote.server.common.ZVoteProperties;

/** What this server offers, so a client can adapt its UI to it. */
@RestController
public class ServerInfoController {

    private final ZVoteProperties settings;

    ServerInfoController(ZVoteProperties settings) {
        this.settings = settings;
    }

    @GetMapping("/api/server-info")
    public ServerInfo serverInfo() {
        return new ServerInfo(settings.features(), settings.limits(), settings.publicUrl());
    }
}
