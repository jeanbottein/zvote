package org.zvote.server.polls;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.zvote.server.common.VoterSecret;

import java.util.OptionalLong;

import static org.assertj.core.api.Assertions.assertThat;

class InvitationLinksTest {

    final InvitationLinks links = new InvitationLinks(new VoterSecret("a secret of at least thirty-two characters"));

    @Test
    void aTokenIsTheInvitationsNumberAndASignatureOfIt() {
        var token = links.tokenOf(7, 42);

        assertThat(token).matches("42\\.[A-Za-z0-9_-]{22}");
        assertThat(links.numberOf(7, token)).hasValue(42);
        assertThat(links.numberOf(7, links.tokenOf(7, 999_999_999_999L))).hasValue(999_999_999_999L);
    }

    @Test
    void aTokenOnlyOpensItsOwnInvitationOnItsOwnPoll() {
        var token = links.tokenOf(7, 42);
        var signature = token.substring(token.indexOf('.'));

        assertThat(links.numberOf(8, token)).isEmpty();
        assertThat(links.numberOf(7, "43" + signature)).isEmpty();
        assertThat(links.numberOf(7, links.tokenOf(8, 42))).isEmpty();
        assertThat(new InvitationLinks(new VoterSecret("another secret of thirty-two characters")).numberOf(7, token))
            .isEmpty();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "42", "42.", "0.AAAAAAAAAAAAAAAAAAAAAA", "-1.AAAAAAAAAAAAAAAAAAAAAA",
        "99999999999999999999.AAAAAAAAAAAAAAAAAAAAAA", "42.AAAAAAAAAAAAAAAAAAAAAA", "42.AAAAAAAAAAAAAAAAAAAAA=",
        " 42.AAAAAAAAAAAAAAAAAAAAAA"})
    void anythingElseIsNoInvitation(String token) {
        assertThat(links.numberOf(7, token)).isEqualTo(OptionalLong.empty());
    }
}
