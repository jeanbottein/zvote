import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { errorMessage, joinPoll } from '../api/client';

/** Opens a poll from the short code someone read out or showed on a screen. */
export default function JoinForm() {
  const navigate = useNavigate();
  const inputId = useId();
  const problemId = useId();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function join(event: FormEvent) {
    event.preventDefault();
    // A code is letters and digits: dashes and spaces, whatever their kind, only help reading it.
    const typed = code.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (typed === '') {
      setProblem('Type the code you were given.');
      return;
    }
    setJoining(true);
    setProblem(null);
    try {
      const poll = await joinPoll(typed);
      navigate(`/p/${poll.id}`);
    } catch (error) {
      setProblem(errorMessage(error));
      setJoining(false);
    }
  }

  return (
    <form className="panel join-form" onSubmit={join} noValidate>
      <label htmlFor={inputId}>Got a code?</label>
      <div className="join-row">
        <input
          id={inputId}
          className="join-code"
          value={code}
          maxLength={12}
          placeholder="K7M-4QX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" className="button primary" disabled={joining}>
          {joining ? 'Joining…' : 'Join'}
        </button>
      </div>
      {problem && <p id={problemId} className="field-problem" role="alert">{problem}</p>}
    </form>
  );
}
