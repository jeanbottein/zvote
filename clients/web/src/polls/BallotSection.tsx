import { useId, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { castBallot, errorMessage } from '../api/client';
import type { Mention, Poll } from '../api/types';
import ApprovalBallot from '../features/VotingSystem/Approval/ApprovalBallot';
import MajorityJudgmentBallot from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentBallot';
import MajorityJudgmentDropdownBallot from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentDropdownBallot';
import { usePreferences } from '../preferences/preferences';
import { isEnter } from '../ui/keys';
import { useToast } from '../ui/Toasts';
import { useBallot, type SubmissionMode } from './useBallot';
import { useServerInfo } from './useServerInfo';

interface BallotSectionProps {
  poll: Poll;
  /** Receives the poll as the server returns it after a ballot. */
  onCast(poll: Poll): void;
}

/** The voter's own ballot, in the poll's voting system. */
export default function BallotSection(props: BallotSectionProps) {
  return props.poll.votingSystem === 'MAJORITY_JUDGMENT'
    ? <MajorityJudgmentBallotSection {...props} />
    : <ApprovalBallotSection {...props} />;
}

const NO_JUDGMENTS: Record<string, Mention> = {};
const NO_APPROVALS: string[] = [];

function MajorityJudgmentBallotSection({ poll, onCast }: BallotSectionProps) {
  const [{ mjBallot, submission }] = usePreferences();
  const showToast = useToast();
  const voter = useVoterName(poll);
  const ballot = useBallot({
    saved: poll.myBallot?.judgments ?? NO_JUDGMENTS,
    mode: submission,
    equals: sameJudgments,
    cast: async (judgments) => onCast(await castBallot(poll.id, { judgments, voterName: voter.forBallot })),
    castChanged: voter.changedSinceCast,
    onError: (error) => showToast(errorMessage(error), 'error'),
  });
  const complete = poll.options.every((option) => ballot.ballot[option.id]);
  const Ballot = mjBallot === 'dropdown' ? MajorityJudgmentDropdownBallot : MajorityJudgmentBallot;

  return (
    <BallotFrame
      mode={submission}
      counted={poll.myBallot !== null}
      unsent={ballot.hasChanges}
      busy={ballot.busy}
      canSubmit={ballot.hasChanges && complete}
      submitLabel={complete ? 'Submit my ballot' : 'Rate every option to submit'}
      onSubmit={ballot.submit}
      onWithdraw={() => ballot.withdraw(NO_JUDGMENTS)}
      instructions={submission === 'live'
        ? 'Give every option a mention. Options you have not rated count as Bad.'
        : 'Give every option a mention, then submit your ballot.'}
      nameField={poll.showVoterNames && <VoterNameField poll={poll} voter={voter} onCommit={ballot.recast} />}
    >
      <Ballot options={poll.options} ballot={ballot.ballot} onChange={ballot.change} />
    </BallotFrame>
  );
}

function ApprovalBallotSection({ poll, onCast }: BallotSectionProps) {
  const [{ submission }] = usePreferences();
  const showToast = useToast();
  const voter = useVoterName(poll);
  const ballot = useBallot({
    saved: poll.myBallot?.approvedOptionIds ?? NO_APPROVALS,
    mode: submission,
    equals: sameApprovals,
    cast: async (approvedOptionIds) =>
      onCast(await castBallot(poll.id, { approvedOptionIds, voterName: voter.forBallot })),
    castChanged: voter.changedSinceCast,
    onError: (error) => showToast(errorMessage(error), 'error'),
  });

  return (
    <BallotFrame
      mode={submission}
      counted={poll.myBallot !== null}
      unsent={ballot.hasChanges}
      busy={ballot.busy}
      canSubmit={ballot.hasChanges}
      submitLabel="Submit my ballot"
      onSubmit={ballot.submit}
      onWithdraw={() => ballot.withdraw(NO_APPROVALS)}
      instructions="Tick every option you would be happy with."
      nameField={poll.showVoterNames && <VoterNameField poll={poll} voter={voter} onCommit={ballot.recast} />}
    >
      <ApprovalBallot options={poll.options} approved={ballot.ballot} onChange={ballot.change} />
    </BallotFrame>
  );
}

interface BallotFrameProps {
  mode: SubmissionMode;
  /** The server holds a ballot from this voter. */
  counted: boolean;
  /** Envelope mode: changes not submitted yet. */
  unsent: boolean;
  busy: boolean;
  canSubmit: boolean;
  submitLabel: string;
  onSubmit(): void;
  onWithdraw(): void;
  instructions: string;
  /** Polls that show names: the voter's name, above the ballot. */
  nameField: ReactNode;
  children: ReactNode;
}

/**
 * A ballot counted before the page opened starts hidden: whoever looks at
 * this screen, over a shoulder or on a projector, does not see what the voter
 * chose. They open it to change it, and can hide it again. A ballot the voter
 * touches stays open, so that it does not vanish once counted.
 */
function BallotFrame(props: BallotFrameProps) {
  const {
    mode, counted, unsent, busy, canSubmit, submitLabel, onSubmit, onWithdraw, instructions, nameField, children,
  } = props;
  const titleId = useId();
  const body = useRef<HTMLDivElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const [revealed, setRevealed] = useState(false);

  /** Focus goes to the voter's choices, not to the name field, which would open the keyboard on a phone. */
  function reveal() {
    flushSync(() => setRevealed(true));
    body.current?.querySelector<HTMLElement>('input[type="radio"]:checked, input[type="checkbox"], select')?.focus();
  }

  function hide() {
    flushSync(() => setRevealed(false));
    changeButton.current?.focus();
  }

  return (
    <section className="ballot" aria-labelledby={titleId}>
      <div className="section-header">
        <h2 id={titleId}>Your ballot</h2>
        {counted && (
          <button type="button" className="button link" disabled={busy} onClick={onWithdraw}>
            Withdraw
          </button>
        )}
      </div>
      {revealed || !counted
        ? <div className="ballot-body" ref={body} onChange={() => setRevealed(true)}>
          {nameField}
          <p className="hint">{instructions}</p>
          {children}
          {mode === 'envelope' && (
            <button type="button" className="button primary wide" disabled={!canSubmit || busy} onClick={onSubmit}>
              {busy ? 'Submitting…' : submitLabel}
            </button>
          )}
          <p className="ballot-status" data-counted={counted}>
            {counted ? 'Your ballot is counted. You can change it until the poll closes.' : 'You have not voted yet.'}
          </p>
          {counted && !unsent && (
            <button type="button" className="button link" onClick={hide}>
              Hide my ballot
            </button>
          )}
        </div>
        : <>
          <p className="ballot-status" data-counted={true}>
            Your ballot is counted. It stays hidden here, so nobody looking at this screen sees your choices.
          </p>
          <button type="button" className="button secondary wide" ref={changeButton} onClick={reveal}>
            Change my ballot
          </button>
        </>}
    </section>
  );
}

type VoterName = ReturnType<typeof useVoterName>;

/**
 * The name this voter gives on a poll that shows names. It starts as the name
 * their ballot carries, or, before they vote, the one they last gave anywhere
 * (remembered in this browser). Blank means anonymous.
 */
function useVoterName(poll: Poll) {
  const [preferences, updatePreferences] = usePreferences();
  // A counted ballot says whether this voter gave a name here; an anonymous one stays anonymous.
  const [name, setName] = useState(() => (poll.myBallot ? poll.myBallot.voterName ?? '' : preferences.voterName));
  const trimmed = name.trim();
  return {
    name,
    change: setName,
    /** Offers the name again on the next poll. */
    remember() {
      if (trimmed !== preferences.voterName) {
        updatePreferences({ voterName: trimmed });
      }
    },
    /** What the ballot carries: nothing at all on a poll that hides names. */
    forBallot: poll.showVoterNames ? trimmed || null : undefined,
    changedSinceCast: poll.myBallot !== null && trimmed !== (poll.myBallot.voterName ?? ''),
  };
}

interface VoterNameFieldProps {
  poll: Poll;
  voter: VoterName;
  onCommit(): void;
}

function VoterNameField({ poll, voter, onCommit }: VoterNameFieldProps) {
  const { limits } = useServerInfo();
  const inputId = useId();
  const hintId = useId();

  function commit() {
    voter.remember();
    onCommit();
  }

  return (
    <div className="field voter-name">
      <label htmlFor={inputId}>Your name</label>
      <input
        id={inputId}
        value={voter.name}
        maxLength={limits.maxVoterNameLength}
        placeholder="Leave blank to stay anonymous"
        autoComplete="nickname"
        enterKeyHint="done"
        aria-describedby={hintId}
        onChange={(event) => voter.change(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (isEnter(event)) {
            event.currentTarget.blur(); // commits
          }
        }}
      />
      <p id={hintId} className="hint">
        {poll.resultsShown === 'AFTER_CLOSING'
          ? 'Everyone on this poll sees the names given, never who chose what.'
          : 'Everyone on this poll sees the names given. The results move as ballots arrive, so people watching may tell who chose what.'}
      </p>
    </div>
  );
}

function sameJudgments(a: Record<string, Mention>, b: Record<string, Mention>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameApprovals(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
