package org.zvote.server.api;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.UncategorizedSQLException;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionHandlerTest {

    final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void aBallotThatWaitedTooLongOnPostgresqlIsToldToTryAgain() {
        var timedOut = new UncategorizedSQLException("lock", "SELECT ... FOR SHARE",
            new SQLException("canceling statement due to lock timeout", "55P03"));

        var answer = handler.collision(timedOut);

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(answer.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("1");
        assertThat(answer.getBody().getDetail()).endsWith("Please try again.");
        assertThat(answer.getBody().getType()).hasToString("/problems/collision");
    }

    @Test
    void anyOtherUncategorizedFailureIsUnexpected() {
        var failure = new UncategorizedSQLException("query", "SELECT 1", new SQLException("disk full", "53100"));

        var answer = handler.collision(failure);

        assertThat(answer.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(answer.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNull();
        assertThat(answer.getBody().getType()).hasToString("/problems/server-error");
    }
}
