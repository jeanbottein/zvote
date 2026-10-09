import { Link, useLocation, useParams } from 'react-router';
import type { Poll } from '../api/types';
import Notice from '../ui/Notice';
import BallotSection from './BallotSection';
import DevBallotFeeder from './DevBallotFeeder';
import { formatDate, timeAgo, VISIBILITY_NAMES, VOTING_SYSTEM_NAMES } from './format';
import Invitations from './Invitations';
import { handoverIn, invitationIn } from './links';
import OwnerActions from './OwnerActions';
import ResultsSection from './ResultsSection';
import ShareButton from './ShareButton';
import { useHandover } from './useHandover';
import { usePoll } from './usePoll';

/**
 * A poll: your ballot, and the results as they come in. Its address is its
 * share link; an invitation's link adds the invitation in the fragment, and a
 * handover link the token that makes you the poll's creator.
 */
export default function PollPage() {
  const { id = '' } = useParams();
  const hash = useLocation().hash;
  const invitation = invitationIn(hash);
  const handover = useHandover(id, handoverIn(hash));

  if (handover === 'taking') {
    return <p className="panel">Taking this poll over...</p>;
  }
  // Keyed, so that moving to another poll, or another invitation, starts from a clean slate.
  return <PollScreen key={`${id}#${invitation}`} id={id} invitation={invitation} />;
}

const home = <Link className="button primary" to="/">Back to the home page</Link>;

function PollScreen({ id, invitation }: { id: string; invitation: string | null }) {
  const { poll, error, deleted, connection, setPoll } = usePoll(id, invitation);
  const justCreated = (useLocation().state as { created?: boolean } | null)?.created === true;

  if (deleted) {
    return <Notice title="This poll was deleted" action={home}><p>It was deleted, and its results with it.</p></Notice>;
  }
  if (error?.status === 404) {
    return <Notice title="Poll not found" action={home}><p>The link may be incomplete, or the poll was deleted.</p></Notice>;
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
      {justCreated && poll.isMine && poll.totalBallots === 0 && (poll.invitationOnly
        ? <p className="panel callout">
          <span><strong>Your poll is ready.</strong> Invite people below: each gets a link of their own.</span>
        </p>
        : <section className="panel callout">
          <p><strong>Your poll is ready.</strong> Share its link to collect ballots.</p>
          <ShareButton poll={poll} className="button primary" />
        </section>)}
      {poll.closedAt
        ? <p className="panel callout">Voting closed {timeAgo(poll.closedAt)}. These are the final results.</p>
        : <BallotSection poll={poll} invitation={invitation} onCast={setPoll} />}
      {poll.isMine && poll.invitationOnly && <Invitations poll={poll} />}
      <ResultsSection poll={poll} connection={connection} />
      <p className="hint expiry">This poll and its ballots will be deleted on {formatDate(poll.expiresAt)}.</p>
      {poll.isMine && <OwnerActions poll={poll} onChange={setPoll} />}
      {import.meta.env.DEV && poll.isMine && !poll.invitationOnly && <DevBallotFeeder poll={poll} />}
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
          {poll.invitationOnly && <span>By invitation</span>}
          <span>Created {timeAgo(poll.createdAt)}</span>
          {poll.closedAt && <span className="badge">Closed</span>}
        </p>
        <ShareButton poll={poll} />
      </div>
    </section>
  );
}
