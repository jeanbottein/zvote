import { useId, type ReactNode } from 'react';
import { castBallot, errorMessage } from '../api/client';
import type { Mention, Poll } from '../api/types';
import ApprovalBallot from '../features/VotingSystem/Approval/ApprovalBallot';
import MajorityJudgmentBallot from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentBallot';
import MajorityJudgmentDropdownBallot from '../features/VotingSystem/MajorityJudgment/MajorityJudgmentDropdownBallot';
import { usePreferences } from '../preferences/preferences';
import { useToast } from '../ui/Toasts';
import { useBallot, type SubmissionMode } from './useBallot';

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
  const ballot = useBallot({
    saved: poll.myBallot?.judgments ?? NO_JUDGMENTS,
    mode: submission,
    equals: sameJudgments,
    cast: async (judgments) => onCast(await castBallot(poll.id, { judgments })),
    onError: (error) => showToast(errorMessage(error), 'error'),
  });
  const complete = poll.options.every((option) => ballot.ballot[option.id]);
  const Ballot = mjBallot === 'dropdown' ? MajorityJudgmentDropdownBallot : MajorityJudgmentBallot;

  return (
    <BallotFrame
      mode={submission}
      counted={poll.myBallot !== null}
      busy={ballot.busy}
      canSubmit={ballot.hasChanges && complete}
      submitLabel={complete ? 'Submit my ballot' : 'Rate every option to submit'}
      onSubmit={ballot.submit}
      onWithdraw={() => ballot.withdraw(NO_JUDGMENTS)}
      instructions={submission === 'live'
        ? 'Give every option a mention. Options you have not rated count as Bad.'
        : 'Give every option a mention, then submit your ballot.'}
    >
      <Ballot options={poll.options} ballot={ballot.ballot} onChange={ballot.change} />
    </BallotFrame>
  );
}

function ApprovalBallotSection({ poll, onCast }: BallotSectionProps) {
  const [{ submission }] = usePreferences();
  const showToast = useToast();
  const ballot = useBallot({
    saved: poll.myBallot?.approvedOptionIds ?? NO_APPROVALS,
    mode: submission,
    equals: sameApprovals,
    cast: async (approvedOptionIds) => onCast(await castBallot(poll.id, { approvedOptionIds })),
    onError: (error) => showToast(errorMessage(error), 'error'),
  });

  return (
    <BallotFrame
      mode={submission}
      counted={poll.myBallot !== null}
      busy={ballot.busy}
      canSubmit={ballot.hasChanges}
      submitLabel="Submit my ballot"
      onSubmit={ballot.submit}
      onWithdraw={() => ballot.withdraw(NO_APPROVALS)}
      instructions="Tick every option you would be happy with."
    >
      <ApprovalBallot options={poll.options} approved={ballot.ballot} onChange={ballot.change} />
    </BallotFrame>
  );
}

interface BallotFrameProps {
  mode: SubmissionMode;
  /** The server holds a ballot from this voter. */
  counted: boolean;
  busy: boolean;
  canSubmit: boolean;
  submitLabel: string;
  onSubmit(): void;
  onWithdraw(): void;
  instructions: string;
  children: ReactNode;
}

function BallotFrame(props: BallotFrameProps) {
  const { mode, counted, busy, canSubmit, submitLabel, onSubmit, onWithdraw, instructions, children } = props;
  const titleId = useId();

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
    </section>
  );
}

function sameJudgments(a: Record<string, Mention>, b: Record<string, Mention>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

function sameApprovals(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
