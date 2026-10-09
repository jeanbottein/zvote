package org.zvote.server.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.zvote.server.common.VoterSecret;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Resolves the caller on every API request, issuing a voter token to
 * newcomers, so that handlers simply declare
 * {@code @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter}.
 *
 * The cookie is SameSite=Lax: browsers do not send it on cross-site POST, PUT,
 * PATCH or DELETE requests, and the server enables no CORS, so another site
 * cannot act as a voter (no CSRF token needed).
 */
@Component
public class VoterIdentityFilter extends OncePerRequestFilter {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration COOKIE_LIFETIME = Duration.ofDays(365);

    /** 256 random bits, base64url: exactly what {@link #newToken()} issues. */
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{43}");

    private final VoterSecret secret;

    public VoterIdentityFilter(VoterSecret secret) {
        this.secret = secret;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        var token = tokenFrom(request).orElse(null);
        if (token == null) {
            // First visit, or a cookie we did not issue: start a fresh identity.
            token = newToken();
            response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(VoterIdentity.COOKIE, token)
                .httpOnly(true)
                .secure(request.isSecure())
                .sameSite("Lax")
                .path("/")
                .maxAge(COOKIE_LIFETIME)
                .build()
                .toString());
        }
        request.setAttribute(VoterIdentity.ATTRIBUTE, new Voter(token, secret));
        chain.doFilter(request, response);
    }

    private static Optional<String> tokenFrom(HttpServletRequest request) {
        var cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
            .filter(cookie -> VoterIdentity.COOKIE.equals(cookie.getName()))
            .map(Cookie::getValue)
            .filter(TOKEN.asMatchPredicate())
            .findFirst();
    }

    private static String newToken() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
