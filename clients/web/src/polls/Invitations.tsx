import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { createInvitations, errorMessage, listInvitations, revokeInvitation } from '../api/client';
import type { Invitation, InvitationPage, Poll } from '../api/types';
import Confirmation from '../ui/Confirmation';
import { CheckIcon, CloseIcon, ShareIcon } from '../ui/icons';
import { useToast } from '../ui/Toasts';
import { formatCount } from '../utils/formatCount';
import { invitationUrl } from './links';
import ShareDialog from './ShareDialog';
import { useServerInfo } from './useServerInfo';

/** Invitations shown at first, and added by each "Show more", up to the most a page can hold. */
const PAGE = 100;
const MAX_PAGE = 1000;

/**
 * The creator's invitations to a poll that only invited people may vote on:
 * one link per person, which they send themselves. The newest come first, and
 * each says whether someone voted with it, never with which ballot. The list
 * is read again as ballots come in.
 */
export default function Invitations({ poll }: { poll: Poll }) {
  const { limits } = useServerInfo();
  const showToast = useToast();
  const titleId = useId();
  const inputId = useId();
  const [page, setPage] = useState<InvitationPage | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState<Invitation | null>(null);
  const [changes, setChanges] = useState(0);
  const open = poll.closedAt === null;

  // Read again after each change, and whenever the number of ballots moves: one of them may have used an
  // invitation. Only the latest answer counts.
  useEffect(() => {
    let active = true;
    listInvitations(poll.id, shown).then(
      (newest) => {
        if (active) {
          setPage(newest);
        }
      },
      (error: unknown) => {
        if (active) {
          showToast(errorMessage(error), 'error');
        }
      },
    );
    return () => {
      active = false;
    };
  }, [poll.id, poll.totalBallots, shown, changes, showToast]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    try {
      const named = label.trim();
      await createInvitations(poll.id, named ? { labels: [named] } : { count: 1 });
      setLabel('');
      setChanges((count) => count + 1);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function revoke(number: number) {
    try {
      await revokeInvitation(poll.id, number);
      setChanges((count) => count + 1);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  }

  return (
    <section className="panel invitations" aria-labelledby={titleId}>
      <div className="section-header">
        <h2 id={titleId}>Invitations</h2>
        {page !== null && page.count > 0 && <span className="invitation-count">{summary(page)}</span>}
      </div>
      <p className="hint">
        Only the people you invite can vote. Send each one a link of their own, which holds one ballot. You see which
        links were used, never what anyone chose. You can vote yourself without one.
      </p>
      {open && (
        <form className="invite-form" onSubmit={invite}>
          <label htmlFor={inputId}>Invite someone</label>
          <div className="invite-row">
            <input
              id={inputId}
              value={label}
              maxLength={limits.maxVoterNameLength}
              placeholder="Name or nickname (optional)"
              autoComplete="off"
              enterKeyHint="done"
              onChange={(event) => setLabel(event.target.value)}
            />
            <button type="submit" className="button primary" disabled={adding}>
              {adding ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </form>
      )}
      {page === null
        ? <p className="empty" aria-busy="true">Loading the invitations…</p>
        : page.invitations.length > 0 && (
          <ul className="invitation-list">
            {page.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.number}
                invitation={invitation}
                pollOpen={open}
                onShare={() => setSharing(invitation)}
                onRevoke={() => revoke(invitation.number)}
              />
            ))}
          </ul>
        )}
      {page?.next != null && (shown < MAX_PAGE
        ? <button type="button" className="button secondary" onClick={() => setShown(shown + PAGE)}>Show more</button>
        : <p className="hint">The newest {formatCount(MAX_PAGE)} are shown.</p>)}
      <ShareDialog
        open={sharing !== null}
        onClose={() => setSharing(null)}
        title={sharing?.label ? `Invitation for ${sharing.label}` : nameOf(sharing)}
        hint="Send this link to this person only. It holds one ballot, which only the browser they vote from can change."
        url={sharing ? invitationUrl(poll.id, sharing.token) : ''}
        linkLabel="Link of the invitation"
        subject={poll.title}
        message={`You are invited to vote on “${poll.title}”. This link is for you alone.`}
      />
    </section>
  );
}

/** "3 of 10 used" once every invitation is shown; until then, how many there are. */
function summary(page: InvitationPage): string {
  if (page.next !== null) {
    return `${formatCount(page.count)} invitations`;
  }
  const used = page.invitations.filter((invitation) => invitation.used).length;
  return `${formatCount(used)} of ${formatCount(page.count)} used`;
}

/** Whom it is for, or, if the creator did not say, its number. */
function nameOf(invitation: Invitation | null): string {
  return invitation?.label ?? `Invitation ${invitation?.number ?? ''}`;
}

interface InvitationRowProps {
  invitation: Invitation;
  /** While the poll is open, an invitation nobody voted with can be taken back. */
  pollOpen: boolean;
  onShare(): void;
  onRevoke(): Promise<void>;
}

function InvitationRow({ invitation, pollOpen, onShare, onRevoke }: InvitationRowProps) {
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const revokeButton = useRef<HTMLButtonElement>(null);
  const name = nameOf(invitation);

  /** Back to the button that asked, so that keyboard and screen reader users keep their place. */
  function keep() {
    flushSync(() => setConfirming(false));
    revokeButton.current?.focus();
  }

  async function confirm() {
    setBusy(true);
    await onRevoke();
    setBusy(false);
    setConfirming(false);
  }

  return (
    <li className="invitation" data-used={invitation.used}>
      <div className="invitation-text">
        <span className="invitation-name" data-anonymous={invitation.label === null}>{name}</span>
        <span className="invitation-status">
          {invitation.used ? <><CheckIcon /> Used</> : 'Not used yet'}
        </span>
      </div>
      <button type="button" className="icon-button" aria-label={`Share the link for ${name}`} onClick={onShare}>
        <ShareIcon />
      </button>
      {pollOpen && (invitation.used
        ? <span className="icon-button-placeholder" aria-hidden="true" /> // keeps the share buttons in line
        : <button
          type="button" className="icon-button" ref={revokeButton} aria-label={`Take back the link for ${name}`}
          onClick={() => setConfirming(true)}
        >
          <CloseIcon />
        </button>)}
      {confirming && (
        <Confirmation
          id={confirmId}
          question="Take back this invitation? Its link will stop working."
          busy={busy}
          keep="Keep it"
          confirm="Take it back"
          tone="danger"
          onKeep={keep}
          onConfirm={confirm}
        />
      )}
    </li>
  );
}
