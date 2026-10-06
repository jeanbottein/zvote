import type { ReactNode } from 'react';
import { Link } from 'react-router';
import JoinForm from './JoinForm';
import PollList from './PollList';
import { usePollLists } from './usePollLists';
import { useServerInfo } from './useServerInfo';

export default function HomePage() {
  const { lists, error } = usePollLists();
  const { features } = useServerInfo();

  return (
    <>
      <title>zvote · decide together</title>
      <section className="hero">
        <h1>Decide together, fairly.</h1>
        <p>
          Create a private poll, share its link or code with your group, and watch
          the results come in live. Nobody needs an account.
        </p>
        <Link className="button primary" to="/new">Create a poll</Link>
      </section>

      <JoinForm />

      {error ? (
        <p className="panel error-text" role="alert">{error}</p>
      ) : (
        <>
          <Section title="Your polls">
            {lists ? <PollList polls={lists.mine} empty="Polls you create will appear here." /> : <Loading />}
          </Section>
          {features.publicPolls && (
            <Section title="Public polls">
              {lists ? <PollList polls={lists.others} empty="No public polls yet." /> : <Loading />}
            </Section>
          )}
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
