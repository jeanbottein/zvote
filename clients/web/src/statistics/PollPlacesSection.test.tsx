import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPollPlaces } from '../api/client';
import PollPlacesSection from './PollPlacesSection';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  getPollPlaces: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getPollPlaces).mockResolvedValue({
    asOf: '2026-10-12T14:00:00Z',
    places: [{ timeZone: 'Europe/Berlin', ballots: 5 }],
    regions: [{ region: 'Europe', ballots: 7 }, { region: 'America', ballots: 3 }],
  });
});

describe("a poll's places", () => {
  it('shows where its ballots come from, by region and city', async () => {
    render(<PollPlacesSection pollId="lunch" />);

    const table = within(await screen.findByRole('table'));
    expect(getPollPlaces).toHaveBeenCalledWith('lunch');
    expect(table.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual(['Europe', 'Berlin', 'The Americas']);
    expect(screen.getByRole('img', { name: /World map of ballots/ }).querySelectorAll('.world-map-dot')).toHaveLength(1);
  });

  it('says what it waits for when no region has enough ballots', async () => {
    vi.mocked(getPollPlaces).mockResolvedValue({ asOf: '2026-10-12T14:00:00Z', places: [], regions: [] });
    render(<PollPlacesSection pollId="lunch" />);

    expect(await screen.findByText('A region shows once three ballots come from it.')).toBeInTheDocument();
  });

  it('shows nothing while the results are kept back', async () => {
    vi.mocked(getPollPlaces).mockResolvedValue({ asOf: '2026-10-12T14:00:00Z', places: null, regions: null });
    const { container } = render(<PollPlacesSection pollId="lunch" />);

    await vi.waitFor(() => expect(getPollPlaces).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
