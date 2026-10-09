/**
 * Doing something once, however many times a client asks for it.
 *
 * A browser's user clicks again; an agent whose request timed out sends it
 * again, having no way to know whether the first one landed. For a poll that
 * means two polls, and for invitations two links to the same person, who can
 * then vote twice. A client that cares sends an Idempotency-Key, and the
 * second request answers what the first one did.
 *
 * It knows nothing of polls: it keeps what a request answered with, and hands
 * it back.
 */
@ApplicationModule(displayName = "Idempotent requests", allowedDependencies = "common")
package org.zvote.server.idempotency;

import org.springframework.modulith.ApplicationModule;
