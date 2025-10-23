// ============================================
// CLIENT CONFIGURATION
// ============================================
// This file contains client-side feature flags and settings.
// These are separate from server capabilities and control
// client-only features like dev tools.

/**
 * Development Tools Configuration
 */
export const DEV_TOOLS = {
  // Enable the DevBallotFeeder component (for testing)
  ENABLE_BALLOT_FEEDER: true,
  
  // Show ballot feeder only for user's own votes
  ONLY_OWN_VOTES: true,
};

/**
 * UI Configuration
 */
export const UI_CONFIG = {
  // Show detailed debug information in console
  DEBUG_MODE: false,
  
  // Enable experimental features
  EXPERIMENTAL_FEATURES: false,
};

/**
 * Check if dev tools should be visible
 */
export function shouldShowDevTools(): boolean {
  return DEV_TOOLS.ENABLE_BALLOT_FEEDER;
}

/**
 * Check if ballot feeder should be shown for a specific vote
 * @param voteCreator - The Identity object of the vote creator
 * @param currentUser - The current user's Identity object
 */
export function shouldShowBallotFeeder(
  voteCreator: any,
  currentUser: any
): boolean {
  if (!DEV_TOOLS.ENABLE_BALLOT_FEEDER) {
    return false;
  }
  
  if (DEV_TOOLS.ONLY_OWN_VOTES) {
    // Only show for user's own votes
    return voteCreator?.toString() === currentUser?.identity;
  }
  
  return true;
}
