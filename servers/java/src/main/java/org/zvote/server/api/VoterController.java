package org.zvote.server.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.zvote.server.api.dto.NewVoter;
import org.zvote.server.identity.VoterIdentity;

/**
 * Mints a voter identity for a client that keeps its own credential instead of
 * a cookie: an agent, a script, a packaged app. The token then goes on every
 * request as {@code Authorization: Bearer <token>}.
 *
 * It mints, and never reveals: the answer is always a voter nobody has been
 * before, never the caller's own token. So a script on the page that called it
 * would learn nothing - and it grants nothing new either, since every /api
 * request already hands a fresh identity to whoever has none.
 */
@RestController
public class VoterController {

    @PostMapping("/api/voters")
    public ResponseEntity<NewVoter> mint() {
        return ResponseEntity.status(HttpStatus.CREATED).body(new NewVoter(VoterIdentity.newToken()));
    }
}
