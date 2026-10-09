import type { PollOption } from '../../api/types';

/** An option as the results show it: where the server placed it, and whether it shares that place. */
export interface Ranked {
  option: PollOption;
  rank: number;
  exAequo: boolean;
}

/**
 * The options in the order the results show them, best first, from the rank
 * the server sent with each (see the server's api.Ranking: it is computed
 * once, there, and the counts travel beside it so it can be checked).
 *
 * Options arrive in the poll's own order, which is what a ballot's bytes are
 * positions in, so ordering them is the client's business; ranking them is
 * not. Options sharing a rank keep the poll's order between themselves.
 */
export function ranked(options: PollOption[]): Ranked[] {
  const places = options.map((option) => option.rank ?? 1);
  return options
    .map((option, index) => ({
      option,
      rank: places[index],
      exAequo: places.filter((rank) => rank === places[index]).length > 1,
    }))
    .sort((a, b) => a.rank - b.rank);
}
