import type { ReactNode } from 'react';
import { Link } from 'react-router';
import PollList from './PollList';
import { usePollLists } from './usePollLists';

export default function HomePage() {
  const { lists, error } = usePollLists();

  return (
    <>
      <title>zvote · decide together</title>
      <section className="hero">
        <h1>Decide together, fairly.</h1>
        <p>
          Rate every option with majority judgment, or approve the ones you like.
          Results update live, and nobody needs an account.
        </p>
        <Link className="button primary" to="/new">Create a poll</Link>
      </section>

      {error ? (
        <p className="panel error-text" role="alert">{error}</p>
      ) : (
        <>
          <Section title="Your polls">
            {lists ? <PollList polls={lists.mine} empty="Polls you create will appear here." /> : <Loading />}
          </Section>
          <Section title="Public polls">
            {lists ? <PollList polls={lists.others} empty="No public polls yet." /> : <Loading />}
          </Section>
        </>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Loading() {
  return <p className="empty" aria-busy="true">Loading…</p>;
}
