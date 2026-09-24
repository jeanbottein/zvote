/**
 * The zvote API.
 *
 * Who is voting is decided by an HttpOnly cookie the server sets, so every call
 * carries credentials. A call without them would silently count as a brand new
 * voter: polls would stop being "mine" and ballots could not be revised.
 */
import type { BallotRequest, NewPoll, Poll, PollSummary, PollUpdate, ServerInfo } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE_URL + path, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
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

export const getPoll = (id: string) => request<Poll>('GET', pollPath(id));

export const createPoll = (poll: NewPoll) => request<Poll>('POST', '/api/polls', poll);

export const castBallot = (id: string, ballot: BallotRequest) =>
  request<Poll>('PUT', `${pollPath(id)}/ballot`, ballot);

export const setPollClosed = (id: string, closed: boolean) =>
  request<Poll>('PATCH', pollPath(id), { closed });

export const deletePoll = (id: string) => request<void>('DELETE', pollPath(id));

export interface PollWatcher {
  onUpdate(update: PollUpdate): void;
  onDeleted(): void;
  onConnectionChange(live: boolean): void;
}

/**
 * Follows a poll live, over server-sent events. The first update is the poll's
 * current state. After a network hiccup the browser reconnects by itself, and
 * the new connection starts with the current state again. Returns a function
 * that stops watching.
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
  source.addEventListener('error', () => watcher.onConnectionChange(false));
  return () => source.close();
}
