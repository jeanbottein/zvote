/** The addresses people share: a poll's, and an invitation's. */

export function pollUrl(pollId: string): string {
  return `${window.location.origin}/p/${pollId}`;
}

/**
 * The poll's address, with the invitation in its fragment: browsers never
 * send a fragment to the server, so no log along the way keeps it.
 */
export function invitationUrl(pollId: string, token: string): string {
  return `${pollUrl(pollId)}#invitation=${token}`;
}

/** The invitation in a page address's fragment (location.hash), if there is one. */
export function invitationIn(hash: string): string | null {
  return new URLSearchParams(hash.slice(1)).get('invitation') || null;
}
