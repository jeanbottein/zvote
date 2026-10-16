/**
 * What one network may do in a day: create polls, and try join codes that
 * lead to no poll. super-vote is free and runs on limited resources, so each
 * network gets a fair share of polls; and a join code is short enough to be
 * guessed, unlike a link, so guessing them is stopped. Kept in memory only, for
 * a day at most: nothing about a network is ever written.
 */
@ApplicationModule(displayName = "Rate limits", allowedDependencies = {})
package org.supervote.server.ratelimit;

import org.springframework.modulith.ApplicationModule;
