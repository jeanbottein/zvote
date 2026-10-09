package org.zvote.server.api;

import org.junit.jupiter.api.Test;
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

        var problem = handler.collision(timedOut);

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getDetail()).endsWith("Please try again.");
    }

    @Test
    void anyOtherUncategorizedFailureIsUnexpected() {
        var failure = new UncategorizedSQLException("query", "SELECT 1", new SQLException("disk full", "53100"));

        assertThat(handler.collision(failure).getStatus()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR.value());
    }
}
