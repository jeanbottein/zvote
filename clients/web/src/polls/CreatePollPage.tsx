import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { createPoll, errorMessage } from '../api/client';
import type { Visibility, VotingSystem } from '../api/types';
import { CloseIcon } from '../ui/icons';
import SegmentedControl from '../ui/SegmentedControl';
import {
  checkPollForm, filledOptions, offeredVisibilities, offeredVotingSystems, optionRows,
} from './pollForm';
import { useServerInfo } from './useServerInfo';

const VOTING_SYSTEM_HINTS: Record<VotingSystem, string> = {
  MAJORITY_JUDGMENT:
    'Voters rate every option from Excellent to Bad. The option a majority rates best wins: nuanced, and hard to game.',
  APPROVAL: 'Voters tick every option they would accept. The most approved option wins: quick and simple.',
};

const VISIBILITY_HINTS: Record<Visibility, string> = {
  PUBLIC: 'Listed on the home page, for anyone to find.',
  UNLISTED: 'Not listed anywhere: only people you share the link with can find it.',
};

export default function CreatePollPage() {
  const navigate = useNavigate();
  const info = useServerInfo();
  const { limits } = info;
  const ids = useId();

  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [votingSystem, setVotingSystem] = useState<VotingSystem>('MAJORITY_JUDGMENT');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [showProblems, setShowProblems] = useState(false);
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const systems = offeredVotingSystems(info);
  const visibilities = offeredVisibilities(info);
  // Whatever this server offers, one of its choices is always selected.
  const chosenSystem = systems.some((s) => s.value === votingSystem) ? votingSystem : systems[0]?.value;
  const chosenVisibility = visibilities.some((v) => v.value === visibility) ? visibility : visibilities[0]?.value;

  const rows = optionRows(options, limits.maxOptions);
  const problems = showProblems ? checkPollForm(title, options, limits) : {};

  function setOption(index: number, value: string) {
    setOptions((current) => {
      const next = [...current];
      while (next.length < index) {
        next.push('');
      }
      next[index] = value;
      return next;
    });
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index));
  }

  /** Enter moves to the next row rather than submitting a half-written poll. */
  function focusRowOnEnter(event: KeyboardEvent<HTMLInputElement>, row: number) {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    const next = event.currentTarget.form?.elements.namedItem(`option-${row}`);
    if (next instanceof HTMLInputElement) {
      next.focus();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowProblems(true);
    if (Object.keys(checkPollForm(title, options, limits)).length > 0 || !chosenSystem || !chosenVisibility) {
      return;
    }
    setCreating(true);
    setFailure(null);
    try {
      const poll = await createPoll({
        title: title.trim(),
        options: filledOptions(options),
        votingSystem: chosenSystem,
        visibility: chosenVisibility,
      });
      navigate(`/p/${poll.id}`, { state: { created: true } });
    } catch (error) {
      setFailure(errorMessage(error));
      setCreating(false);
    }
  }

  return (
    <form className="panel create-poll" onSubmit={submit} noValidate>
      <title>New poll · zvote</title>
      <h1>New poll</h1>

      <div className="field">
        <label htmlFor={`${ids}-title`}>Question</label>
        <input
          id={`${ids}-title`}
          value={title}
          maxLength={limits.maxTitleLength}
          placeholder="Where do we eat on Friday?"
          enterKeyHint="next"
          aria-invalid={problems.title ? true : undefined}
          aria-describedby={problems.title ? `${ids}-title-problem` : undefined}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => focusRowOnEnter(event, 0)}
        />
        {problems.title && <p id={`${ids}-title-problem`} className="field-problem">{problems.title}</p>}
      </div>

      <fieldset className="field" aria-describedby={problems.options ? `${ids}-options-problem` : undefined}>
        <legend>Options</legend>
        <ol className="option-rows">
          {rows.map((option, row) => (
            <li key={row} className="option-row">
              <input
                name={`option-${row}`}
                value={option}
                maxLength={limits.maxOptionLength}
                placeholder={`Option ${row + 1}`}
                aria-label={`Option ${row + 1}`}
                enterKeyHint="next"
                onChange={(event) => setOption(row, event.target.value)}
                onKeyDown={(event) => focusRowOnEnter(event, row + 1)}
              />
              {option !== '' && (
                <button type="button" className="icon-button" aria-label={`Remove ${option}`} onClick={() => removeOption(row)}>
                  <CloseIcon />
                </button>
              )}
            </li>
          ))}
        </ol>
        {problems.options
          ? <p id={`${ids}-options-problem`} className="field-problem">{problems.options}</p>
          : <p className="hint">Up to {limits.maxOptions} options. A new row appears as you type.</p>}
      </fieldset>

      {chosenSystem && systems.length > 1 && (
        <SegmentedControl
          legend="Voting system"
          name="votingSystem"
          value={chosenSystem}
          options={systems}
          onChange={(system) => setVotingSystem(system)}
          hint={VOTING_SYSTEM_HINTS[chosenSystem]}
        />
      )}

      {chosenVisibility && visibilities.length > 1 && (
        <SegmentedControl
          legend="Who can find it"
          name="visibility"
          value={chosenVisibility}
          options={visibilities}
          onChange={(choice) => setVisibility(choice)}
          hint={VISIBILITY_HINTS[chosenVisibility]}
        />
      )}

      {failure && <p className="error-text" role="alert">{failure}</p>}

      <button type="submit" className="button primary wide" disabled={creating}>
        {creating ? 'Creating…' : 'Create poll'}
      </button>
    </form>
  );
}
