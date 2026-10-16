package org.supervote.server.ratelimit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NetworkTest {

    @Test
    void anIpv4AddressIsANetworkOfItsOwn() {
        assertThat(Network.of("203.0.113.7")).isEqualTo(new Network("203.0.113.7"));
        assertThat(Network.of("203.0.113.7")).isNotEqualTo(Network.of("203.0.113.8"));
    }

    /** A household or a phone holds a whole /64: its addresses one by one would be as many networks as it likes. */
    @Test
    void ipv6AddressesCountByTheirSlash64() {
        assertThat(Network.of("2001:db8:1:2:3:4:5:6")).isEqualTo(Network.of("2001:db8:1:2:ffff::1"));
        assertThat(Network.of("2001:db8:1:2::1")).isEqualTo(new Network("2001:db8:1:2::/64"));
        assertThat(Network.of("2001:db8:1:2::1")).isNotEqualTo(Network.of("2001:db8:1:3::1"));
    }

    @Test
    void anIpv4AddressWrittenAsIpv6IsStillItself() {
        assertThat(Network.of("::ffff:203.0.113.7")).isEqualTo(Network.of("203.0.113.7"));
    }

    @Test
    void whatIsNoAddressIsStillOneNetwork() {
        assertThat(Network.of("unknown")).isEqualTo(new Network("unknown"));
    }
}
