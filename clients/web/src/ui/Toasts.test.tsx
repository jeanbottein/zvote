import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toasts';

function Page() {
  const showToast = useToast();
  return (
    <>
      <button type="button" onClick={() => showToast('The poll was deleted.')}>Delete</button>
      <button type="button" onClick={() => showToast('The server cannot be reached.', 'error')}>Fail</button>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  render(<ToastProvider><Page /></ToastProvider>);
});

afterEach(() => {
  vi.useRealTimers();
});

const toasts = () => screen.queryAllByText(/\.$/, { selector: '.toast span' });

describe('toasts', () => {
  it('say what happened, and go away on their own', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('status')).toHaveTextContent('The poll was deleted.');
    act(() => vi.advanceTimersByTime(3500));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('leave errors up longer', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    act(() => vi.advanceTimersByTime(3500));
    expect(screen.getByRole('alert')).toHaveTextContent('The server cannot be reached.');
    act(() => vi.advanceTimersByTime(2500));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can be dismissed', () => {
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('never pile up past three', () => {
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    }

    expect(toasts()).toHaveLength(3);
  });
});
