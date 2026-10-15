import { useEffect, useState } from 'react';
import { getPollPlaces } from '../api/client';
import type { PollPlaces } from '../api/types';
import PlacesTable from './PlacesTable';
import WorldMap from './WorldMap';

const BALLOTS = [{ key: 'ballots' as const, label: 'Ballots' }];

/**
 * Where a poll's ballots come from, by time zone: shown once its results
 * are, and as of the last hour. Loaded with the map, only on polls that may
 * have something to show.
 */
export default function PollPlacesSection({ pollId }: { pollId: string }) {
  const [places, setPlaces] = useState<PollPlaces | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    let active = true;
    // Nothing to show if it fails: the results above are what matters.
    getPollPlaces(pollId).then((answer) => active && setPlaces(answer), () => {});
    return () => {
      active = false;
    };
  }, [pollId]);

  if (!places?.places || !places.regions) {
    return null;
  }
  const dots = places.places.map((place) => ({ timeZone: place.timeZone, count: place.ballots }));
  return (
    <section className="panel statistics-panel">
      <h2>Where the ballots come from</h2>
      {places.regions.length === 0 ? (
        <p className="hint">A region shows once three ballots come from it.</p>
      ) : (
        <>
          <WorldMap dots={dots} what="ballots" selected={selected} onSelect={setSelected} focus={focus} />
          <PlacesTable regions={places.regions} places={places.places} columns={BALLOTS} orderBy="ballots"
            onShow={(timeZone) => {
              setSelected(timeZone);
              setFocus((count) => count + 1);
            }} />
          <p className="hint">
            From each voter's time zone, never their address. A place shows once three ballots come from
            it, and the numbers are updated every hour.
          </p>
        </>
      )}
    </section>
  );
}
