package org.zvote.server.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.data.relational.core.conversion.DbActionExecutionException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.polls.NotPollCreatorException;
import org.zvote.server.polls.PollClosedException;
import org.zvote.server.polls.PollNotFoundException;

/**
 * Every error is an RFC 9457 problem document (application/problem+json) whose
 * "detail" is a sentence meant for the person using the app. The base class
 * does the same for Spring MVC's own errors: 404, 405, 415 and so on.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler
    ProblemDetail pollNotFound(PollNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND,
            "That poll does not exist. The link may be mistyped, or the poll was deleted.");
    }

    @ExceptionHandler
    ProblemDetail notCreator(NotPollCreatorException e) {
        return problem(HttpStatus.FORBIDDEN, "Only the poll's creator can do that.");
    }

    @ExceptionHandler
    ProblemDetail pollClosed(PollClosedException e) {
        return problem(HttpStatus.CONFLICT, "This poll is closed and no longer accepts ballots.");
    }

    @ExceptionHandler
    ProblemDetail invalid(InvalidRequestException e) {
        return problem(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    /**
     * Changes made at the same instant: two ballots from the same voter for one
     * poll (the database keeps one and rejects the other), or a ballot that
     * waited too long for a poll being changed. Trying again is safe.
     */
    @ExceptionHandler({DataIntegrityViolationException.class, TransientDataAccessException.class,
        DbActionExecutionException.class})
    ProblemDetail collision(RuntimeException e) {
        if (!isCollision(e) && !isCollision(e.getCause())) {
            return unexpected(e);
        }
        return problem(HttpStatus.CONFLICT, "That change collided with another one made at the same moment. Please try again.");
    }

    /** Anything else is a bug, or the database away: logged in full, and told without details. */
    @ExceptionHandler
    ProblemDetail unexpected(RuntimeException e) {
        log.error("Unexpected failure", e);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Something went wrong on our side. Please try again in a moment.");
    }

    private static boolean isCollision(Throwable e) {
        return e instanceof DataIntegrityViolationException || e instanceof TransientDataAccessException;
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException e, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        var problem = problem(HttpStatus.BAD_REQUEST,
            "The request body could not be read. Send JSON with the documented fields and values.");
        return handleExceptionInternal(e, problem, headers, status, request);
    }

    private static ProblemDetail problem(HttpStatus status, String detail) {
        return ProblemDetail.forStatusAndDetail(status, detail);
    }
}
