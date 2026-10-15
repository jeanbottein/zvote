import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getStatistics } from '../api/client';
import type { Statistics } from '../api/types';
import { renderAt } from '../test/render';
import { lastDays } from './ActivityChart';
import StatisticsPage from './StatisticsPage';
import { radiusOf } from './WorldMap';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getStatistics: vi.fn(),
}));

const statistics: Statistics = {
  asOf: '2026-10-12T14:00:00Z',
  polls: 1_250,
  openPolls: 40,
  ballots: 8_150,
  voters: 3_005,
  places: [
    { timeZone: 'Europe/Paris', polls: 1_000, ballots: 8_000, voters: 2_000 },
    { timeZone: 'Asia/Tokyo', polls: 200, ballots: 80, voters: 1_000 },
  ],
  regions: [
    { region: 'Europe', polls: 1_000, ballots: 8_000, voters: 2_000 },
    { region: 'Asia', polls: 200, ballots: 80, voters: 1_000 },
  ],
  days: [
    { day: '2026-10-11', polls: 5, ballots: 30, voters: 12 },
    { day: '2026-10-12', polls: 2, ballots: 9, voters: 4 },
  ],
};

beforeEach(() => {
  vi.mocked(getStatistics).mockResolvedValue(statistics);
});

const open = () => renderAt('/statistics', [{ path: '/statistics', element: <StatisticsPage /> }]);

const map = () => screen.getByRole('img', { name: /World map/ });

const dot = (timeZone: string) => map().querySelector(`[data-zone="${timeZone}"]`)!;

/** A tap: a press and a release without moving. */
function tap(element: Element) {
  fireEvent.pointerDown(element, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
}

describe('the statistics page', () => {
  it('shows the totals', async () => {
    open();

    const total = async (label: string) => (await screen.findByText(label, { selector: 'dt' })).parentElement;
    expect(await total('Polls created')).toHaveTextContent('1,250');
    expect(await total('Open now')).toHaveTextContent('40');
    expect(await total('Ballots cast')).toHaveTextContent('8,150');
    expect(await total('Visitors')).toHaveTextContent('3,005');
  });

  it('draws no country, only a dot at each place, sized by its count', async () => {
    open();
    await screen.findByText('Polls created', { selector: 'dt' });

    expect(map().querySelectorAll('.world-map-land')).toHaveLength(1);
    expect(map().querySelectorAll('.world-map-dot')).toHaveLength(2);
    expect(Number(dot('Europe/Paris').getAttribute('r'))).toBeGreaterThan(Number(dot('Asia/Tokyo').getAttribute('r')));

    await userEvent.click(screen.getByRole('radio', { name: 'Polls' }));

    expect(Number(dot('Europe/Paris').getAttribute('r'))).toBe(radiusOf(1_000, 1_000));
  });

  it('names a tapped place by its city and region, with its numbers', async () => {
    open();
    await screen.findByText('Polls created', { selector: 'dt' });

    tap(dot('Asia/Tokyo'));

    expect(screen.getByRole('heading', { name: 'Tokyo · Asia' })).toBeInTheDocument();
    expect(screen.getByText('1,000 visitors · 200 polls · 80 ballots')).toBeInTheDocument();
  });

  it('reads the last 90 days, the last one first', async () => {
    open();

    expect(await screen.findByText('visitors on Oct 12', { exact: false })).toHaveTextContent('4 visitors on Oct 12');
    expect(screen.getByRole('img', { name: /16 visitors over the last 90 days, the most on Oct 11: 12/ }))
      .toBeInTheDocument();
  });

  it('lists the regions, each with its cities, and what is shown nowhere', async () => {
    open();
    const table = within(await screen.findByRole('table'));

    expect(table.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Europe', 'Paris', 'Asia', 'Tokyo']);
    expect(screen.getByText(/Not shown in any region.*5 visitors, 50 polls and 70 ballots/)).toBeInTheDocument();

    await userEvent.click(table.getByRole('button', { name: 'Tokyo' }));
    expect(screen.getByRole('heading', { name: 'Tokyo · Asia' })).toBeInTheDocument();
    expect(map().querySelector('.world-map-chosen')).toBeInTheDocument();
    expect(map().getAttribute('viewBox')!.split(' ')[2]).toBe('250');
  });

  it('zooms in and out', async () => {
    open();
    await screen.findByText('Polls created', { selector: 'dt' });
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' });
    expect(zoomOut).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }));

    expect(map().getAttribute('viewBox')!.split(' ')[2]).toBe('500');
    expect(zoomOut).toBeEnabled();
  });

  it('says why it cannot show them', async () => {
    vi.mocked(getStatistics).mockRejectedValue(new ApiError(503, 'The server is restarting.'));
    open();

    expect(await screen.findByRole('alert')).toHaveTextContent('The server is restarting.');
  });
});

describe('the last 90 days', () => {
  it('end on the day of the statistics, with nothing on days without any', () => {
    const days = lastDays(statistics.days, statistics.asOf);

    expect(days).toHaveLength(90);
    expect(days[0]).toEqual({ day: '2026-07-15', polls: 0, ballots: 0, voters: 0 });
    expect(days.slice(-2)).toEqual(statistics.days);
  });
});

describe('a dot', () => {
  it('has an area that follows its count', () => {
    const area = (count: number) => (radiusOf(count, 100) - radiusOf(0, 100)) ** 2;
    expect(area(100) / area(25)).toBeCloseTo(4);
  });
});
