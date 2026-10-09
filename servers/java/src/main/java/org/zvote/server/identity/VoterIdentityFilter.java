package org.zvote.server.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.zvote.server.common.VoterSecret;

import java.io.IOException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;

/**
 * Resolves the caller on every API request, issuing a voter token to
 * newcomers, so that handlers simply declare
 * {@code @RequestAttribute(VoterIdentity.ATTRIBUTE) Voter voter}.
 *
 * A browser is known by its cookie, which is SameSite=Lax: browsers do not
 * send it on cross-site POST, PUT, PATCH or DELETE requests, and the server
 * enables no CORS, so another site cannot act as a voter (no CSRF token
 * needed). Every other client - an agent, a script, a packaged app - sends the
 * same token as {@code Authorization: Bearer}, which beats the cookie and
 * takes no cookie back.
 *
 * POST /api/voters is left out: it mints identities, so it needs none.
 */
@Component
public class VoterIdentityFilter extends OncePerRequestFilter {

    private static final Duration COOKIE_LIFETIME = Duration.ofDays(365);
    private static final String BEARER = "Bearer ";

    private final VoterSecret secret;
    private final HandlerExceptionResolver resolver;

    public VoterIdentityFilter(VoterSecret secret,
                               @Qualifier("handlerExceptionResolver") HandlerExceptionResolver resolver) {
        this.secret = secret;
        this.resolver = resolver;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        var uri = request.getRequestURI();
        return !uri.startsWith("/api/") || uri.equals("/api/voters");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        String token;
        try {
            token = tokenOf(request, response);
        } catch (UnknownVoterException e) {
            // A filter throws outside the dispatcher, where @RestControllerAdvice
            // cannot see it: hand it to the same resolver so one place shapes every error.
            resolver.resolveException(request, response, null, e);
            return;
        }
        request.setAttribute(VoterIdentity.ATTRIBUTE, new Voter(token, secret));
        chain.doFilter(request, response);
    }

    private String tokenOf(HttpServletRequest request, HttpServletResponse response) {
        var authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null) {
            return bearerOf(authorization);
        }
        return cookieOf(request).orElseGet(() -> issue(request, response));
    }

    private static String bearerOf(String authorization) {
        var token = authorization.regionMatches(true, 0, BEARER, 0, BEARER.length())
            ? authorization.substring(BEARER.length()).trim()
            : "";
        if (!VoterIdentity.TOKEN.matcher(token).matches()) {
            throw new UnknownVoterException("This voter token is not one this server issued. "
                + "Ask for one at POST /api/voters, and send it as \"Authorization: Bearer <token>\".");
        }
        return token;
    }

    private static Optional<String> cookieOf(HttpServletRequest request) {
        var cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
            .filter(cookie -> VoterIdentity.COOKIE.equals(cookie.getName()))
            .map(Cookie::getValue)
            .filter(VoterIdentity.TOKEN.asMatchPredicate())
            .findFirst();
    }

    /** First visit, or a cookie we did not issue: start a fresh identity. */
    private static String issue(HttpServletRequest request, HttpServletResponse response) {
        var token = VoterIdentity.newToken();
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(VoterIdentity.COOKIE, token)
            .httpOnly(true)
            .secure(request.isSecure())
            .sameSite("Lax")
            .path("/")
            .maxAge(COOKIE_LIFETIME)
            .build()
            .toString());
        return token;
    }
}
