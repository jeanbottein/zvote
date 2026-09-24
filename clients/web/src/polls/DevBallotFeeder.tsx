import { useState } from 'react';
import type { BallotRequest, Poll } from '../api/types';
import { MENTIONS_BEST_FIRST } from '../features/VotingSystem/MajorityJudgment/mentions';

/**
 * Development only (the poll page renders it when import.meta.env.DEV): casts
 * random ballots to watch the results move. Each ballot is sent without the
 * voter cookie, so the server counts it as a new, anonymous voter.
 */
export default function DevBallotFeeder({ poll }: { poll: Poll }) {
  const [count, setCount] = useState(20);
  const [cast, setCast] = useState<number | null>(null);

  async function feed() {
    for (let i = 1; i <= count; i++) {
      setCast(i);
      await fetch(`/api/polls/${encodeURIComponent(poll.id)}/ballot`, {
        method: 'PUT',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomBallot(poll)),
      });
    }
    setCast(null);
  }

  return (
    <section className="panel dev-tool">
      <h2>Ballot feeder <span className="badge">dev only</span></h2>
      <div className="button-row">
        <input
          type="number"
          min={1}
          max={500}
          value={count}
          aria-label="Number of random ballots"
          onChange={(event) => setCount(Number(event.target.value))}
        />
        <button type="button" className="button secondary" disabled={cast !== null} onClick={feed}>
          {cast === null ? 'Cast random ballots' : `Casting ${cast} of ${count}…`}
        </button>
      </div>
    </section>
  );
}

function randomBallot(poll: Poll): BallotRequest {
  if (poll.votingSystem === 'APPROVAL') {
    return { approvedOptionIds: poll.options.filter(() => Math.random() < 0.5).map((option) => option.id) };
  }
  return {
    judgments: Object.fromEntries(poll.options.map((option) => [
      option.id,
      MENTIONS_BEST_FIRST[Math.floor(Math.random() * MENTIONS_BEST_FIRST.length)],
    ])),
  };
}
