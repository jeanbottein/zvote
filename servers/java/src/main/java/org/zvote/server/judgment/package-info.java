/**
 * Majority judgment ballots: each voter gives every option one of seven
 * mentions. Stands alone, like approval ballots. It counts the ballots; the
 * client ranks the options.
 */
@ApplicationModule(displayName = "Majority judgment ballots", allowedDependencies = {})
package org.zvote.server.judgment;

import org.springframework.modulith.ApplicationModule;
