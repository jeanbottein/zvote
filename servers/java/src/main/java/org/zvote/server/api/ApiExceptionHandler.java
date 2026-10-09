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
import org.springframework.jdbc.UncategorizedSQLException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.zvote.server.common.InvalidRequestException;
import org.zvote.server.identity.UnknownVoterException;
import org.zvote.server.polls.HandoverUnavailableException;
import org.zvote.server.polls.InvitationUsedException;
import org.zvote.server.polls.NotInvitedException;
import org.zvote.server.polls.NotPollCreatorException;
import org.zvote.server.polls.PollClosedException;
import org.zvote.server.polls.PollNotFoundException;

/**
 * Every error is an RFC 9457 problem document (application/problem+json) whose
 * "detail" is a sentence meant for the person using the app, and whose "type"
 * says the same thing to a machine ({@link ProblemType}). The base class does
 * the same for Spring MVC's own errors: 404, 405, 415 and so on.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    private static final String LOCK_NOT_AVAILABLE = "55P03";

    @ExceptionHandler
    ProblemDetail pollNotFound(PollNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, e.getMessage(), ProblemType.POLL_NOT_FOUND);
    }

    @ExceptionHandler
    ProblemDetail notCreator(NotPollCreatorException e) {
        return problem(HttpStatus.FORBIDDEN, "Only the poll's creator can do that.", ProblemType.NOT_POLL_CREATOR);
    }

    @ExceptionHandler
    ProblemDetail notInvited(NotInvitedException e) {
        return problem(HttpStatus.FORBIDDEN, e.getMessage(), ProblemType.NOT_INVITED);
    }

    @ExceptionHandler
    ProblemDetail handoverUnavailable(HandoverUnavailableException e) {
        return problem(HttpStatus.FORBIDDEN, e.getMessage(), ProblemType.HANDOVER_UNAVAILABLE);
    }

    @ExceptionHandler
    ProblemDetail pollClosed(PollClosedException e) {
        return problem(HttpStatus.CONFLICT, e.getMessage(), ProblemType.POLL_CLOSED);
    }

    @ExceptionHandler
    ProblemDetail invitationUsed(InvitationUsedException e) {
        return problem(HttpStatus.CONFLICT, e.getMessage(), ProblemType.INVITATION_USED);
    }

    /**
     * A bearer token this server could not have issued. The challenge header is
     * what tells a client it may authenticate, rather than that it may not.
     */
    @ExceptionHandler
    ResponseEntity<ProblemDetail> unknownVoter(UnknownVoterException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
            .body(problem(HttpStatus.UNAUTHORIZED, e.getMessage(), ProblemType.UNKNOWN_VOTER));
    }

    @ExceptionHandler
    ProblemDetail invalid(InvalidRequestException e) {
        return problem(HttpStatus.BAD_REQUEST, e.getMessage(), ProblemType.INVALID_REQUEST);
    }

    /**
     * Changes made at the same instant: two ballots from the same voter for one
     * poll (the database keeps one and rejects the other), or a ballot that
     * waited too long for a poll being changed. Trying again is safe.
     */
    @ExceptionHandler({DataIntegrityViolationException.class, TransientDataAccessException.class,
        DbActionExecutionException.class, UncategorizedSQLException.class})
    ResponseEntity<ProblemDetail> collision(RuntimeException e) {
        if (!isCollision(e) && !isCollision(e.getCause())) {
            return ResponseEntity.internalServerError().body(unexpected(e));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .header(HttpHeaders.RETRY_AFTER, "1") // a moment, so a client retrying does not pile on
            .body(problem(HttpStatus.CONFLICT,
                "That change collided with another one made at the same moment. Please try again.",
                ProblemType.COLLISION));
    }

    /** Anything else is a bug, or the database away: logged in full, and told without details. */
    @ExceptionHandler
    ProblemDetail unexpected(RuntimeException e) {
        log.error("Unexpected failure", e);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR,
            "Something went wrong on our side. Please try again in a moment.", ProblemType.SERVER_ERROR);
    }

    private static boolean isCollision(Throwable e) {
        return e instanceof DataIntegrityViolationException || e instanceof TransientDataAccessException
            || isLockTimeout(e);
    }

    /** PostgreSQL's lock_timeout running out, which Spring leaves uncategorized. */
    private static boolean isLockTimeout(Throwable e) {
        return e instanceof UncategorizedSQLException uncategorized
            && uncategorized.getSQLException() != null
            && LOCK_NOT_AVAILABLE.equals(uncategorized.getSQLException().getSQLState());
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException e, HttpHeaders headers,
                                                                  HttpStatusCode status, WebRequest request) {
        var problem = problem(HttpStatus.BAD_REQUEST,
            "The request body could not be read. Send JSON with the documented fields and values.",
            ProblemType.INVALID_REQUEST);
        return handleExceptionInternal(e, problem, headers, status, request);
    }

    private static ProblemDetail problem(HttpStatus status, String detail, ProblemType type) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(type.uri());
        return problem;
    }
}
