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

/**
 * The poll's address, with the token that hands it over in its fragment. A
 * client that created a poll for somebody sends them this, and opening it
 * makes them its creator. Like an invitation, it stays out of every log.
 */
export function handoverUrl(pollId: string, token: string): string {
  return `${pollUrl(pollId)}#handover=${token}`;
}

/** The invitation in a page address's fragment (location.hash), if there is one. */
export function invitationIn(hash: string): string | null {
  return tokenIn(hash, 'invitation');
}

/** The handover token in a page address's fragment, if there is one. */
export function handoverIn(hash: string): string | null {
  return tokenIn(hash, 'handover');
}

function tokenIn(hash: string, name: string): string | null {
  return new URLSearchParams(hash.slice(1)).get(name) || null;
}
