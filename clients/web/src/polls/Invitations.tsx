import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { createInvitation, errorMessage, listInvitations, revokeInvitation } from '../api/client';
import type { Invitation, Poll } from '../api/types';
import Confirmation from '../ui/Confirmation';
import { CheckIcon, CloseIcon, ShareIcon } from '../ui/icons';
import { useToast } from '../ui/Toasts';
import { formatCount } from '../utils/formatCount';
import { invitationUrl } from './links';
import ShareDialog from './ShareDialog';
import { useServerInfo } from './useServerInfo';

/**
 * The creator's invitations to a poll that only invited people may vote on:
 * one link per person, which they send themselves. Each says whether someone
 * voted with it, never with which ballot, and the list is read again as
 * ballots come in.
 */
export default function Invitations({ poll }: { poll: Poll }) {
  const { limits } = useServerInfo();
  const showToast = useToast();
  const titleId = useId();
  const inputId = useId();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [label, setLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState<Invitation | null>(null);
  const [changes, setChanges] = useState(0);
  const open = poll.closedAt === null;

  // Read again after each change, and whenever the number of ballots moves: one of them may have used an
  // invitation. Only the latest answer counts.
  useEffect(() => {
    let active = true;
    listInvitations(poll.id).then(
      (all) => {
        if (active) {
          setInvitations(all);
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
  }, [poll.id, poll.totalBallots, changes, showToast]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setAdding(true);
    try {
      const invitation = await createInvitation(poll.id, label.trim() || null);
      setInvitations((all) => [...(all ?? []), invitation]);
      setLabel('');
      setChanges((count) => count + 1);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function revoke(token: string) {
    try {
      await revokeInvitation(poll.id, token);
      setInvitations((all) => all && all.filter((invitation) => invitation.token !== token));
      setChanges((count) => count + 1);
    } catch (error) {
      showToast(errorMessage(error), 'error');
    }
  }

  const used = invitations?.filter((invitation) => invitation.used).length ?? 0;
  const full = (invitations?.length ?? 0) >= limits.maxInvitations;

  return (
    <section className="panel invitations" aria-labelledby={titleId}>
      <div className="section-header">
        <h2 id={titleId}>Invitations</h2>
        {invitations !== null && invitations.length > 0 && (
          <span className="invitation-count">{formatCount(used)} of {formatCount(invitations.length)} used</span>
        )}
      </div>
      <p className="hint">
        Only the people you invite can vote. Send each one a link of their own, which holds one ballot. You see which
        links were used, never what anyone chose. You can vote yourself without one.
      </p>
      {invitations === null
        ? <p className="empty" aria-busy="true">Loading the invitations…</p>
        : invitations.length > 0 && (
          <ul className="invitation-list">
            {invitations.map((invitation, index) => (
              <InvitationRow
                key={invitation.token}
                invitation={invitation}
                name={nameOf(invitation, index)}
                pollOpen={open}
                onShare={() => setSharing(invitation)}
                onRevoke={() => revoke(invitation.token)}
              />
            ))}
          </ul>
        )}
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
            <button type="submit" className="button primary" disabled={adding || full}>
              {adding ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          {full && <p className="hint">A poll can have at most {formatCount(limits.maxInvitations)} invitations.</p>}
        </form>
      )}
      <ShareDialog
        open={sharing !== null}
        onClose={() => setSharing(null)}
        title={sharing?.label ? `Invitation for ${sharing.label}` : 'Invitation'}
        hint="Send this link to this person only. It holds one ballot, which only the browser they vote from can change."
        url={sharing ? invitationUrl(poll.id, sharing.token) : ''}
        linkLabel="Link of the invitation"
        subject={poll.title}
        message={`You are invited to vote on “${poll.title}”. This link is for you alone.`}
      />
    </section>
  );
}

/** Whom it is for, or, if the creator did not say, its place in the list. */
function nameOf(invitation: Invitation, index: number): string {
  return invitation.label ?? `Invitation ${index + 1}`;
}

interface InvitationRowProps {
  invitation: Invitation;
  name: string;
  /** While the poll is open, an invitation nobody voted with can be taken back. */
  pollOpen: boolean;
  onShare(): void;
  onRevoke(): Promise<void>;
}

function InvitationRow({ invitation, name, pollOpen, onShare, onRevoke }: InvitationRowProps) {
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const revokeButton = useRef<HTMLButtonElement>(null);

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
