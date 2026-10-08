/**
 * The zvote API.
 *
 * Who is voting is decided by an HttpOnly cookie the server sets, so every call
 * carries credentials. A call without them would silently count as a brand new
 * voter: polls would stop being "mine" and ballots could not be revised.
 *
 * A voter's invitation travels in a header, never in a URL, so that no log
 * along the way keeps it.
 */
import type { BallotRequest, Invitation, NewPoll, Poll, PollSummary, PollUpdate, ServerInfo } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

const INVITATION_HEADER = 'Zvote-Invitation';

/** A failed call. The message is written for the person using the app. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** A sentence to show the person using the app, whatever went wrong. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

interface RequestOptions {
  body?: unknown;
  /** The token from the invitation link the voter came with. */
  invitation?: string | null;
  credentials?: RequestCredentials;
}

async function request<T>(
  method: string,
  path: string,
  { body, invitation, credentials = 'include' }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (invitation) {
    headers[INVITATION_HEADER] = invitation;
  }
  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      method,
      credentials,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'The server cannot be reached. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, await problemDetail(response));
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

/** Errors are RFC 9457 problem documents whose "detail" is meant for people. */
async function problemDetail(response: Response): Promise<string> {
  try {
    const problem: unknown = await response.json();
    if (problem && typeof problem === 'object' && 'detail' in problem && typeof problem.detail === 'string') {
      return problem.detail;
    }
  } catch {
    // Not JSON: fall through to a generic message.
  }
  return `Something went wrong (error ${response.status}). Please try again.`;
}

const pollPath = (id: string) => `/api/polls/${encodeURIComponent(id)}`;

export const getServerInfo = () => request<ServerInfo>('GET', '/api/server-info');

export const listPublicPolls = () => request<PollSummary[]>('GET', '/api/polls');

export const listMyPolls = () => request<PollSummary[]>('GET', '/api/polls/mine');

/** As the caller sees it, with the invitation they came with, if any. */
export const getPoll = (id: string, invitation?: string | null) => request<Poll>('GET', pollPath(id), { invitation });

/** The poll behind a join code: its letters and digits. */
export const joinPoll = (code: string) => request<PollSummary>('GET', `/api/join/${encodeURIComponent(code)}`);

export const createPoll = (poll: NewPoll) => request<Poll>('POST', '/api/polls', { body: poll });

/** With the invitation the voter came with, if any: their first ballot makes it theirs. */
export const castBallot = (id: string, ballot: BallotRequest, invitation?: string | null) =>
  request<Poll>('PUT', `${pollPath(id)}/ballot`, { body: ballot, invitation });

/** For good: a closed poll cannot be reopened. */
export const closePoll = (id: string) => request<Poll>('PATCH', pollPath(id), { body: { closed: true } });

export const deletePoll = (id: string) => request<void>('DELETE', pollPath(id));

/** Development only (the ballot feeder): a ballot without the cookie, so from a brand new voter. */
export const castBallotAsNewVoter = (id: string, ballot: BallotRequest) =>
  request<Poll>('PUT', `${pollPath(id)}/ballot`, { body: ballot, credentials: 'omit' });

/** The creator's invitations to their poll, in the order they were made. */
export const listInvitations = (id: string) => request<Invitation[]>('GET', `${pollPath(id)}/invitations`);

/** A new invitation; label: whom it is for, or null. */
export const createInvitation = (id: string, label: string | null) =>
  request<Invitation>('POST', `${pollPath(id)}/invitations`, { body: { label } });

/** Only an invitation nobody voted with can be taken back. Its link stops working. */
export const revokeInvitation = (id: string, token: string) =>
  request<void>('DELETE', `${pollPath(id)}/invitations/${encodeURIComponent(token)}`);

export interface PollWatcher {
  onUpdate(update: PollUpdate): void;
  onDeleted(): void;
  onConnectionChange(live: boolean): void;
  /** The browser stopped reconnecting, as it does when the server answers with an error. */
  onLost(): void;
}

/**
 * Follows a poll live, over server-sent events. The first update is the poll's
 * current state. After a network hiccup the browser reconnects by itself, and
 * the new connection starts with the current state again; but an error from
 * the server, while it restarts for instance, ends the stream for good.
 * Returns a function that stops watching.
 */
export function watchPoll(id: string, watcher: PollWatcher): () => void {
  const source = new EventSource(`${BASE_URL}${pollPath(id)}/events`, { withCredentials: true });
  source.addEventListener('update', (event: MessageEvent<string>) => {
    watcher.onUpdate(JSON.parse(event.data) as PollUpdate);
  });
  source.addEventListener('deleted', () => {
    source.close();
    watcher.onDeleted();
  });
  source.addEventListener('open', () => watcher.onConnectionChange(true));
  source.addEventListener('error', () => {
    watcher.onConnectionChange(false);
    if (source.readyState === EventSource.CLOSED) {
      watcher.onLost();
    }
  });
  return () => source.close();
}
