/**
 * Live updates over server-sent events. It pushes what it is given and knows
 * nothing of polls or ballots.
 */
@ApplicationModule(displayName = "Live updates", allowedDependencies = {})
package org.zvote.server.live;

import org.springframework.modulith.ApplicationModule;
