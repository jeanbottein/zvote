package org.zvote.server.api;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.zvote.server.polls.PollService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** A failure nobody anticipated still answers with a problem document, and is logged in full. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UnexpectedFailureTest {

    @Autowired
    MockMvcTester mvc;

    @MockitoBean
    PollService polls;

    final Logger log = (Logger) LoggerFactory.getLogger(ApiExceptionHandler.class);
    final ListAppender<ILoggingEvent> logged = new ListAppender<>();

    @BeforeEach
    void keepTheLog() {
        logged.start();
        log.addAppender(logged);
        log.setAdditive(false); // kept here, off the console
    }

    @AfterEach
    void releaseTheLog() {
        log.detachAppender(logged);
        log.setAdditive(true);
    }

    @Test
    void isAnsweredWithAProblemDocumentThatGivesNothingAway() {
        when(polls.find("abc")).thenThrow(new IllegalStateException("The disk is full"));

        var result = mvc.get().uri("/api/polls/abc").exchange();

        assertThat(result).hasStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(result).bodyJson().extractingPath("$.detail")
            .isEqualTo("Something went wrong on our side. Please try again in a moment.");
        assertThat(PollApiTest.body(result)).doesNotContain("disk");
        assertThat(logged.list).singleElement()
            .satisfies(event -> assertThat(event.getThrowableProxy().getMessage()).isEqualTo("The disk is full"));
    }
}
