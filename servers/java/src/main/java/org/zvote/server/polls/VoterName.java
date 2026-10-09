package org.zvote.server.polls;

import org.springframework.data.annotation.Id;

/**
 * The name a voter chose on one poll, shown to everyone on that poll. It says
 * who took part, never what they chose: its name key never matches a ballot
 * key, and it records no time to line it up with one. It goes when their
 * ballot goes.
 */
record VoterName(
    @Id Long id,
    Long pollId,
    String nameKey,
    String name
) {
    VoterName renamed(String name) {
        return new VoterName(id, pollId, nameKey, name);
    }
}
