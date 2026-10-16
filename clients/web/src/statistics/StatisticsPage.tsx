import { useEffect, useState } from 'react';
import { errorMessage, getStatistics } from '../api/client';
import type { Activity, Statistics } from '../api/types';
import AppName from '../ui/AppName';
import SegmentedControl from '../ui/SegmentedControl';
import { formatCount } from '../utils/formatCount';
import ActivityChart from './ActivityChart';
import { placeOf, regionName } from './geography';
import PlacesTable, { type Column } from './PlacesTable';
import WorldMap from './WorldMap';

type Measure = keyof Activity;

const MEASURES: Column<Measure>[] = [
  { key: 'voters', label: 'Visitors' },
  { key: 'polls', label: 'Polls' },
  { key: 'ballots', label: 'Ballots' },
];

const updated = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

/** "3 visitors", "1 poll". */
export function plural(count: number, noun: string): string {
  return `${formatCount(count)} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * How much super-vote is used, when and where: totals, the last 90 days, and a
 * map of the time zones people came from. The server publishes them once an
 * hour, places people by their device's time zone, never their address, and
 * names no country.
 */
export default function StatisticsPage() {
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measure, setMeasure] = useState<Measure>('voters');
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    let active = true;
    getStatistics().then(
      (answer) => active && setStatistics(answer),
      (failure: unknown) => active && setError(errorMessage(failure)),
    );
    return () => {
      active = false;
    };
  }, []);

  const showOnMap = (timeZone: string) => {
    setSelected(timeZone);
    setFocus((count) => count + 1);
  };
  const noun = MEASURES.find((option) => option.key === measure)!.label.toLowerCase();

  return (
    <>
      <title>Statistics · super-vote</title>
      <section className="hero">
        <h1><AppName /> around the world</h1>
        <p>How many polls, ballots and visitors, when, and from where.</p>
      </section>

      {error ? (
        <p className="panel error-text" role="alert">{error}</p>
      ) : !statistics ? (
        <p className="empty" aria-busy="true">Loading…</p>
      ) : (
        <>
          <Totals statistics={statistics} />
          <SegmentedControl<Measure> legend="Show" name="measure" value={measure}
            options={MEASURES.map((option) => ({ value: option.key, label: option.label }))}
            onChange={setMeasure} />
          <section className="panel statistics-panel">
            <h2>Over the last 90 days</h2>
            <ActivityChart days={statistics.days} asOf={statistics.asOf} measure={measure} noun={noun} />
          </section>
          <section className="panel statistics-panel">
            <h2>Where</h2>
            <WorldMap
              dots={statistics.places.map((place) => ({ timeZone: place.timeZone, count: place[measure] }))}
              what={noun}
              selected={selected}
              onSelect={setSelected}
              focus={focus}
            />
            <Chosen timeZone={selected} statistics={statistics} />
          </section>
          <section className="panel statistics-panel">
            <h2>By region</h2>
            {statistics.regions.length === 0 ? (
              <p className="empty">No region yet.</p>
            ) : (
              <PlacesTable regions={statistics.regions} places={statistics.places} columns={MEASURES}
                orderBy={measure} onShow={showOnMap} />
            )}
            <Unplaced statistics={statistics} />
          </section>
          <section className="panel statistics-panel">
            <h2>How these are counted</h2>
            <p>
              A visitor is a browser or an app that came to <AppName />: one person on two devices counts twice.
              A ballot counts once, however often its voter changes it.
            </p>
            <p>
              Places come from the time zone your device is set to, never from your address, and only
              totals are kept. A place shows once three visitors come from it. The numbers are updated
              every hour, so that they cannot be matched with the ballots of one poll as they come in.
              Last updated {updated.format(new Date(statistics.asOf))}.
            </p>
            <p className="hint">
              Each dot is the city a time zone is named after, standing for everyone in that zone. Days
              are in UTC. Land from{' '}
              <a href="https://www.naturalearthdata.com" target="_blank" rel="noreferrer">Natural Earth</a>,
              time zones from the{' '}
              <a href="https://www.iana.org/time-zones" target="_blank" rel="noreferrer">IANA database</a>.
            </p>
          </section>
        </>
      )}
    </>
  );
}

function Totals({ statistics }: { statistics: Statistics }) {
  const totals = [
    { label: 'Polls created', value: statistics.polls },
    { label: 'Open now', value: statistics.openPolls },
    { label: 'Ballots cast', value: statistics.ballots },
    { label: 'Visitors', value: statistics.voters },
  ];
  return (
    <dl className="statistics-totals">
      {totals.map((total) => (
        <div key={total.label} className="panel">
          <dt>{total.label}</dt>
          <dd>{formatCount(total.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The numbers of the place chosen on the map or in the table. */
function Chosen({ timeZone, statistics }: { timeZone: string | null; statistics: Statistics }) {
  const place = statistics.places.find((candidate) => candidate.timeZone === timeZone);
  if (!place) {
    return <p className="statistics-chosen hint">Tap a dot to see its numbers.</p>;
  }
  const { city, region } = placeOf(place.timeZone);
  return (
    <div className="statistics-chosen" aria-live="polite">
      <h3>{city} <span className="hint">· {regionName(region)}</span></h3>
      <p>{plural(place.voters, 'visitor')} · {plural(place.polls, 'poll')} · {plural(place.ballots, 'ballot')}</p>
    </div>
  );
}

/** What the totals hold that no region shows: no time zone, or too few to show. */
function Unplaced({ statistics }: { statistics: Statistics }) {
  const rest = (measure: Measure) =>
    statistics[measure] - statistics.regions.reduce((sum, region) => sum + region[measure], 0);
  if (rest('voters') + rest('polls') + rest('ballots') === 0) {
    return null;
  }
  return (
    <p className="hint">
      Not shown in any region, for want of a time zone or of enough people to show:{' '}
      {plural(rest('voters'), 'visitor')}, {plural(rest('polls'), 'poll')} and {plural(rest('ballots'), 'ballot')}.
    </p>
  );
}
