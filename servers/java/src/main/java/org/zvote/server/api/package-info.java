/**
 * The HTTP API: controllers, the shapes they read and write, and the service
 * that composes a poll with its ballots. It is the one module that knows all
 * the others, because composing a poll with its results takes both; no module
 * depends on it.
 */
@ApplicationModule(displayName = "HTTP API")
package org.zvote.server.api;

import org.springframework.modulith.ApplicationModule;
