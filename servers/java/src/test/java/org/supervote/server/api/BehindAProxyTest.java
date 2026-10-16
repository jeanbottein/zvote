package org.supervote.server.api;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Behind the reverse proxy (deploy/Caddyfile), every request comes from the
 * proxy's address, with the client's in X-Forwarded-For and its scheme in
 * X-Forwarded-Proto. Tomcat reads them, so this takes a real socket.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "super-vote.rate-limits.polls-per-day=1")
@ActiveProfiles("test")
class BehindAProxyTest {

    @LocalServerPort
    int port;

    final HttpClient http = HttpClient.newHttpClient();

    @Test
    void limitsCountTheClientsNetworkNotTheProxys() throws Exception {
        assertThat(createPollFrom("203.0.113.10").statusCode()).isEqualTo(201);
        assertThat(createPollFrom("203.0.113.10").statusCode()).isEqualTo(429);
        assertThat(createPollFrom("203.0.113.11").statusCode()).isEqualTo(201);
    }

    @Test
    void theVoterCookieIsSecureBehindHttps() throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/polls/mine"))
            .header("X-Forwarded-For", "203.0.113.12")
            .header("X-Forwarded-Proto", "https")
            .build();

        var response = http.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.headers().firstValue(HttpHeaders.SET_COOKIE)).hasValueSatisfying(cookie ->
            assertThat(cookie).contains("; Secure"));
    }

    private HttpResponse<String> createPollFrom(String client) throws IOException, InterruptedException {
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/polls"))
            .header("X-Forwarded-For", client)
            .header(HttpHeaders.CONTENT_TYPE, "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Ramen", "Tacos"]}
                """))
            .build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }
}
