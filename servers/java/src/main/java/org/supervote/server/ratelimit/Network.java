package org.supervote.server.ratelimit;

import jakarta.servlet.http.HttpServletRequest;

import java.net.Inet6Address;
import java.net.InetAddress;

/**
 * Where a request comes from, as far as limits go: its IPv4 address, or the
 * /64 network of its IPv6 one. An IPv6 household or phone holds a whole /64,
 * so counting its addresses one by one would let it be as many networks as it
 * likes.
 *
 * Behind the reverse proxy, the address is the one the proxy saw, which it
 * passes on in X-Forwarded-For (server.forward-headers-strategy).
 */
public record Network(String prefix) {

    public static Network of(HttpServletRequest request) {
        return of(request.getRemoteAddr());
    }

    static Network of(String address) {
        InetAddress ip;
        try {
            ip = InetAddress.ofLiteral(address);
        } catch (IllegalArgumentException notAnAddress) {
            return new Network(address);
        }
        return new Network(ip instanceof Inet6Address ? slash64(ip.getAddress()) : ip.getHostAddress());
    }

    private static String slash64(byte[] address) {
        return "%x:%x:%x:%x::/64".formatted(group(address, 0), group(address, 2), group(address, 4), group(address, 6));
    }

    private static int group(byte[] address, int at) {
        return (address[at] & 0xff) << 8 | address[at + 1] & 0xff;
    }
}
