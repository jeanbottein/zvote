/**
 * Approval ballots: each voter approves any number of options. Stands alone:
 * it knows polls and options by their ids only, and nothing of the other
 * voting system.
 */
@ApplicationModule(displayName = "Approval ballots", allowedDependencies = {})
package org.zvote.server.approval;

import org.springframework.modulith.ApplicationModule;
