import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, castBallot, createPoll, deletePoll, getPoll, watchPoll } from './client';

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

    await createPoll({ title: 'Lunch?', options: ['Ramen', 'Tacos'], votingSystem: 'APPROVAL', visibility: 'PUBLIC' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({
      title: 'Lunch?', options: ['Ramen', 'Tacos'], votingSystem: 'APPROVAL', visibility: 'PUBLIC',
    });
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
    static last: FakeEventSource;
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

  const watcher = { onUpdate: vi.fn(), onDeleted: vi.fn(), onConnectionChange: vi.fn() };

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
  });

  it('closes the stream when asked', () => {
    const stop = watchPoll('abc', watcher);

    stop();

    expect(FakeEventSource.last.closed).toBe(true);
  });
});
