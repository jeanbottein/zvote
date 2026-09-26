import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBallot, type SubmissionMode } from './useBallot';

/** A server whose answers the test releases one at a time. */
function slowServer() {
  const received: string[] = [];
  const answers: (() => void)[] = [];
  const cast = vi.fn((ballot: string) => {
    received.push(ballot);
    return new Promise<void>((resolve) => answers.push(resolve));
  });
  const answerNext = () => act(async () => answers.shift()?.());
  return { cast, received, answerNext };
}

function renderBallot(mode: SubmissionMode, cast: (ballot: string) => Promise<void>, saved = 'nothing') {
  const onError = vi.fn();
  const hook = renderHook(
    (props: { saved: string; mode: SubmissionMode }) => useBallot({
      saved: props.saved, mode: props.mode, cast, onError, equals: (a, b) => a === b,
    }),
    { initialProps: { saved, mode } },
  );
  return { ...hook, onError };
}

describe('a live ballot', () => {
  it('is cast as soon as it changes, and shows the choice while it travels', () => {
    const server = slowServer();
    const { result } = renderBallot('live', server.cast);

    act(() => result.current.change('Ramen'));

    expect(server.received).toEqual(['Ramen']);
    expect(result.current.ballot).toBe('Ramen');
  });

  it('casts only the latest of the changes made while one was travelling', async () => {
    const server = slowServer();
    const { result } = renderBallot('live', server.cast);

    act(() => result.current.change('Ramen'));
    act(() => result.current.change('Tacos'));
    act(() => result.current.change('Pizza'));

    expect(result.current.ballot).toBe('Pizza');

    await server.answerNext();
    await server.answerNext();

    expect(server.received).toEqual(['Ramen', 'Pizza']);
  });

  it('shows what the server holds once everything has been cast', async () => {
    const server = slowServer();
    const { result, rerender } = renderBallot('live', server.cast);

    act(() => result.current.change('Ramen'));
    rerender({ saved: 'Ramen as saved', mode: 'live' });
    await server.answerNext();

    expect(result.current.ballot).toBe('Ramen as saved');
  });

  it('falls back to what the server holds when casting fails', async () => {
    const failure = new Error('closed');
    const { result, onError } = renderBallot('live', () => Promise.reject(failure));

    await act(async () => result.current.change('Ramen'));

    expect(onError).toHaveBeenCalledWith(failure);
    expect(result.current.ballot).toBe('nothing');
  });
});

describe('an envelope ballot', () => {
  it('keeps changes on the page until submitted', async () => {
    const cast = vi.fn(() => Promise.resolve());
    const { result } = renderBallot('envelope', cast);

    act(() => result.current.change('Ramen'));

    expect(cast).not.toHaveBeenCalled();
    expect(result.current.ballot).toBe('Ramen');
    expect(result.current.hasChanges).toBe(true);

    await act(() => result.current.submit());

    expect(cast).toHaveBeenCalledWith('Ramen');
    expect(result.current.hasChanges).toBe(false);
  });

  it('has nothing to submit when the changes lead back to the saved ballot', () => {
    const { result } = renderBallot('envelope', vi.fn(), 'Ramen');

    act(() => result.current.change('Tacos'));
    act(() => result.current.change('Ramen'));

    expect(result.current.hasChanges).toBe(false);
  });

  it('keeps the changes when submitting fails', async () => {
    const { result, onError } = renderBallot('envelope', () => Promise.reject(new Error('offline')));

    act(() => result.current.change('Ramen'));
    await act(() => result.current.submit());

    expect(onError).toHaveBeenCalled();
    expect(result.current.ballot).toBe('Ramen');
    expect(result.current.busy).toBe(false);
  });
});

describe('withdrawing', () => {
  it('casts the empty ballot and drops unsent changes', async () => {
    const cast = vi.fn(() => Promise.resolve());
    const { result } = renderBallot('envelope', cast, 'Ramen');

    act(() => result.current.change('Tacos'));
    await act(async () => result.current.withdraw('nothing'));

    expect(cast).toHaveBeenCalledWith('nothing');
    expect(result.current.hasChanges).toBe(false);
  });

  it('waits for the ballot on its way, so that it cannot be overtaken', async () => {
    const server = slowServer();
    const { result } = renderBallot('live', server.cast);

    act(() => result.current.change('Ramen'));
    act(() => result.current.withdraw('nothing'));

    expect(result.current.ballot).toBe('nothing');
    expect(server.received).toEqual(['Ramen']);

    await server.answerNext();

    expect(server.received).toEqual(['Ramen', 'nothing']);
  });
});
