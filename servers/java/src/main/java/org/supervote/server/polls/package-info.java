/**
 * Polls: the question being decided, who created it, who may vote on it, and
 * whether it still accepts ballots. A poll knows nothing about how it is
 * voted on. Every rule about polls lives in
 * {@link org.supervote.server.polls.PollService}, but who may vote, in
 * {@link org.supervote.server.polls.InvitationService}; how many polls a
 * network may create, and how many codes it may get wrong, it asks the rate
 * limits.
 */
@ApplicationModule(displayName = "Polls", allowedDependencies = {"common", "ratelimit"})
package org.supervote.server.polls;

import org.springframework.modulith.ApplicationModule;
