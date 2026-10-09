/**
 * Ballots and their tallies, for every voting system: a ballot is one byte per
 * option, which only the api module interprets (a mention's rank, or 1 for an
 * approval). Stands alone: it knows polls by their ids and options by their
 * positions only, and voters by their ballot keys.
 */
@ApplicationModule(displayName = "Ballots", allowedDependencies = {})
package org.zvote.server.ballots;

import org.springframework.modulith.ApplicationModule;
