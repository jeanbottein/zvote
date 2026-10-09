import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, castBallot, castBallotAsNewVoter, createPoll, deletePoll, getPoll, revokeInvitation, watchPoll,
} from './client';
import type { NewPoll } from './types';

describe('the API client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends the voter cookie with every call', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }));

    await getPoll('abc');

    expect(fetchMock).toHaveBeenCalledWith('/api/polls/abc', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }));
  });

  it('sends bodies as JSON', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 }));

    const poll: NewPoll = {
      title: 'Lunch?', options: ['Ramen', 'Tacos'], votingSystem: 'APPROVAL', visibility: 'UNLISTED',
      invitationOnly: false, showVoterNames: false, resultsShown: 'LIVE', resultsAfterBallots: null,
    };

    await createPoll(poll);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual(poll);
  });

  it('sends the invitation a voter came with in a header, never in an address', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ id: 'abc' })));

    await getPoll('abc', 't0k3n');
    await castBallot('abc', { approvedOptionIds: ['1'] }, 't0k3n');

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).not.toContain('t0k3n');
      expect(init?.headers).toMatchObject({ 'Zvote-Invitation': 't0k3n' });
    }
  });

  it('takes an invitation back by its number, never its token', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await revokeInvitation('abc', 42);

    expect(fetchMock).toHaveBeenCalledWith('/api/polls/abc/invitations/42', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('leaves the cookie out of ballots from the ballot feeder, so each comes from a new voter', async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    await castBallotAsNewVoter('abc', { approvedOptionIds: ['1'] });

    expect(fetchMock).toHaveBeenCalledWith('/api/polls/abc/ballot', expect.objectContaining({
      method: 'PUT',
      credentials: 'omit',
    }));
  });

  it('encodes poll ids into paths', async () => {
    fetchMock.mockResolvedValue(Response.json({}));

    await castBallot('a/b', { approvedOptionIds: ['1'] });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/polls/a%2Fb/ballot');
  });

  it('resolves to nothing on 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deletePoll('abc')).resolves.toBeUndefined();
  });

  it('reports the problem detail written by the server', async () => {
    fetchMock.mockResolvedValue(Response.json(
      { status: 409, detail: 'This poll is closed and no longer accepts ballots.' },
      { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
    ));

    const error = await castBallot('abc', { judgments: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'This poll is closed and no longer accepts ballots.' });
  });

  it('explains failures that come without a problem document', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(getPoll('abc')).rejects.toMatchObject({ status: 502, message: expect.stringContaining('502') });
  });

  it('says so when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getPoll('abc')).rejects.toMatchObject({ status: 0, message: expect.stringContaining('cannot be reached') });
  });
});

describe('watching a poll', () => {
  class FakeEventSource extends EventTarget {
    static readonly CLOSED = 2;
    static last: FakeEventSource;
    readyState = 0;
    closed = false;

    constructor(readonly url: string, readonly init?: EventSourceInit) {
      super();
      FakeEventSource.last = this;
    }

    emit(type: string, data?: unknown) {
      this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
    }

    close() {
      this.closed = true;
    }
  }

  const watcher = { onUpdate: vi.fn(), onDeleted: vi.fn(), onConnectionChange: vi.fn(), onLost: vi.fn() };

  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('subscribes to the poll with credentials', () => {
    watchPoll('abc', watcher);

    expect(FakeEventSource.last.url).toBe('/api/polls/abc/events');
    expect(FakeEventSource.last.init).toEqual({ withCredentials: true });
  });

  it('passes updates on', () => {
    watchPoll('abc', watcher);

    FakeEventSource.last.emit('update', { closedAt: null, totalBallots: 3, options: [] });

    expect(watcher.onUpdate).toHaveBeenCalledWith({ closedAt: null, totalBallots: 3, options: [] });
  });

  it('stops listening once the poll is deleted', () => {
    watchPoll('abc', watcher);

    FakeEventSource.last.emit('deleted', {});

    expect(watcher.onDeleted).toHaveBeenCalled();
    expect(FakeEventSource.last.closed).toBe(true);
  });

  it('reports the state of the connection', () => {
    watchPoll('abc', watcher);

    FakeEventSource.last.dispatchEvent(new Event('open'));
    FakeEventSource.last.dispatchEvent(new Event('error'));

    expect(watcher.onConnectionChange.mock.calls).toEqual([[true], [false]]);
    expect(watcher.onLost).not.toHaveBeenCalled(); // the browser is reconnecting
  });

  it('says when the browser gives up reconnecting', () => {
    watchPoll('abc', watcher);

    FakeEventSource.last.readyState = FakeEventSource.CLOSED; // what an error answer does
    FakeEventSource.last.dispatchEvent(new Event('error'));

    expect(watcher.onConnectionChange).toHaveBeenCalledWith(false);
    expect(watcher.onLost).toHaveBeenCalled();
  });

  it('closes the stream when asked', () => {
    const stop = watchPoll('abc', watcher);

    stop();

    expect(FakeEventSource.last.closed).toBe(true);
  });
});
