/**
 * Who is voting: the voter cookie, and the voter every API request carries.
 * It works the same whatever is being voted on.
 */
@ApplicationModule(displayName = "Voter identity", allowedDependencies = {})
package org.zvote.server.identity;

import org.springframework.modulith.ApplicationModule;
