/**
 * How much zvote is used, when and where: polls created, ballots cast and
 * voters met, by time zone, by day and for each poll, and the polls open now.
 * Counted in memory and written once an hour, as totals only: nothing here is
 * about a ballot or a voter, and no country is named.
 */
@ApplicationModule(displayName = "Statistics", allowedDependencies = "polls")
package org.zvote.server.statistics;

import org.springframework.modulith.ApplicationModule;
