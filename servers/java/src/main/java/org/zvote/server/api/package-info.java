/**
 * The HTTP API: controllers, the shapes they read and write, and the services
 * that join polls and ballots, which know nothing of each other: casting,
 * composing a poll with its results, creating a poll with its tallies,
 * folding and retention. It alone knows what a ballot's bytes mean
 * (BallotFormat), and no module depends on it.
 */
@ApplicationModule(displayName = "HTTP API")
package org.zvote.server.api;

import org.springframework.modulith.ApplicationModule;
