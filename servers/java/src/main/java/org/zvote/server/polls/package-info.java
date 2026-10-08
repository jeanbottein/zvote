/**
 * Polls: the question being decided, who created it, who may vote on it, and
 * whether it still accepts ballots. A poll knows nothing about how it is
 * voted on. Every rule about polls lives in
 * {@link org.zvote.server.polls.PollService}, but who may vote, in
 * {@link org.zvote.server.polls.InvitationService}.
 */
@ApplicationModule(displayName = "Polls", allowedDependencies = "common")
package org.zvote.server.polls;

import org.springframework.modulith.ApplicationModule;
