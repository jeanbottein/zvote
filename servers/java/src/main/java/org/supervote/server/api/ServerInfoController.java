package org.supervote.server.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.supervote.server.api.dto.ServerInfo;
import org.supervote.server.common.SuperVoteProperties;

/** What this server offers, so a client can adapt its UI to it. */
@RestController
public class ServerInfoController {

    private final SuperVoteProperties settings;

    ServerInfoController(SuperVoteProperties settings) {
        this.settings = settings;
    }

    @GetMapping("/api/server-info")
    public ServerInfo serverInfo() {
        return new ServerInfo(settings.features(), settings.limits(), settings.publicUrl());
    }
}
