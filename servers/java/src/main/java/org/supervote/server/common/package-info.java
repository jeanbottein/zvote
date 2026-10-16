/** What the modules share: this server's configuration, how its data is read, and the invalid-request error. */
@ApplicationModule(displayName = "Common", allowedDependencies = {})
package org.supervote.server.common;

import org.springframework.modulith.ApplicationModule;
