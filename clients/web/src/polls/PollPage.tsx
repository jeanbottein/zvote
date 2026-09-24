import { Link, useLocation, useParams } from 'react-router';
import type { Poll } from '../api/types';
import Notice from '../ui/Notice';
import BallotSection from './BallotSection';
import DevBallotFeeder from './DevBallotFeeder';
import { timeAgo, VISIBILITY_NAMES, VOTING_SYSTEM_NAMES } from './format';
import OwnerActions from './OwnerActions';
import ResultsSection from './ResultsSection';
import ShareButton from './ShareButton';
import { usePoll } from './usePoll';

/** A poll: your ballot, and the results as they come in. Its address is its share link. */
export default function PollPage() {
  const { id = '' } = useParams();
  // Keyed by id, so moving to another poll starts from a clean slate.
  return <PollScreen key={id} id={id} />;
}

const allPolls = <Link className="button primary" to="/">See all polls</Link>;

function PollScreen({ id }: { id: string }) {
  const { poll, error, deleted, connection, setPoll } = usePoll(id);
  const justCreated = (useLocation().state as { created?: boolean } | null)?.created === true;

  if (deleted) {
    return <Notice title="This poll was deleted" action={allPolls}><p>Its creator deleted it, and its results with it.</p></Notice>;
  }
  if (error?.status === 404) {
    return <Notice title="Poll not found" action={allPolls}><p>The link may be incomplete, or the poll was deleted.</p></Notice>;
  }
  if (error) {
    return (
      <Notice
        title="The poll could not be loaded"
        action={<button type="button" className="button primary" onClick={() => window.location.reload()}>Try again</button>}
      >
        <p>{error.message}</p>
      </Notice>
    );
  }
  if (!poll) {
    return <p className="panel empty" aria-busy="true">Loading the poll…</p>;
  }

  return (
    <>
      <title>{`${poll.title} · zvote`}</title>
      <PollHeader poll={poll} />
      {justCreated && poll.isMine && poll.totalBallots === 0 && (
        <section className="panel callout">
          <p><strong>Your poll is ready.</strong> Share its link to collect ballots.</p>
          <ShareButton poll={poll} className="button primary" />
        </section>
      )}
      {poll.closedAt
        ? <p className="panel callout">Voting closed {timeAgo(poll.closedAt)}. These are the final results.</p>
        : <BallotSection poll={poll} onCast={setPoll} />}
      <ResultsSection poll={poll} connection={connection} />
      {poll.isMine && <OwnerActions poll={poll} onChange={setPoll} />}
      {import.meta.env.DEV && poll.isMine && <DevBallotFeeder poll={poll} />}
    </>
  );
}

function PollHeader({ poll }: { poll: Poll }) {
  return (
    <section className="poll-header">
      <h1>{poll.title}</h1>
      <div className="poll-header-row">
        <p className="poll-meta">
          <span>{VOTING_SYSTEM_NAMES[poll.votingSystem]}</span>
          <span>{VISIBILITY_NAMES[poll.visibility]}</span>
          <span>Created {timeAgo(poll.createdAt)}</span>
          {poll.closedAt && <span className="badge">Closed</span>}
        </p>
        <ShareButton poll={poll} />
      </div>
    </section>
  );
}
