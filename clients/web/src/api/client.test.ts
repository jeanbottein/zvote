import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, castBallot, castBallotAsNewVoter, createPoll, deletePoll, getPoll, revokeInvitation, watchPoll,
} from './client';
import type { NewPoll } from './types';

const lunch: NewPoll = {
  title: 'Lunch?', options: ['Ramen', 'Tacos'], votingSystem: 'APPROVAL', visibility: 'UNLISTED',
  invitationOnly: false, showVoterNames: false, resultsShown: 'LIVE', resultsAfterBallots: null,
};

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

  it('sends nothing else until the first call is answered, so that a new browser gets one cookie', async () => {
    let answer: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    fetchMock.mockResolvedValue(Response.json([]));

    vi.resetModules(); // a fresh page load
    const fresh = await import('./client');
    const first = fresh.getPoll('abc');
    const second = fresh.getPoll('def');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer(Response.json({ id: 'abc' }));
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says the device's time zone, for the statistics, and never more", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }));

    await getPoll('abc');

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toEqual({ 'Super-Vote-Time-Zone': Intl.DateTimeFormat().resolvedOptions().timeZone });
  });

  it('sends bodies as JSON', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 }));

    await createPoll(lunch);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual(lunch);
  });

  it('says how many more polls this connection may create today, from the RateLimit fields', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }, {
      status: 201,
      headers: { 'RateLimit-Policy': '"polls";q=20;w=86400', RateLimit: '"polls";r=4;t=3600' },
    }));
    const before = Date.now();

    const { poll, pollsLeft } = await createPoll(lunch);

    expect(poll).toEqual({ id: 'abc' });
    expect(pollsLeft).toMatchObject({ count: 4, perDay: 20 });
    expect(pollsLeft?.resetsAt).toBeGreaterThanOrEqual(before + 3_600_000);
    expect(pollsLeft?.resetsAt).toBeLessThanOrEqual(Date.now() + 3_600_000);
  });

  it('knows of no polls left from a server that does not say', async () => {
    fetchMock.mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 }));

    expect((await createPoll(lunch)).pollsLeft).toBeNull();
  });

  it('sends the invitation a voter came with in a header, never in an address', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({ id: 'abc' })));

    await getPoll('abc', 't0k3n');
    await castBallot('abc', { approvedOptionIds: ['1'] }, 't0k3n');

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).not.toContain('t0k3n');
      expect(init?.headers).toMatchObject({ 'Super-Vote-Invitation': 't0k3n' });
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
