import React, { useState, useEffect, useRef } from 'react';
import { VotingSystem } from '../generated/index';
import { useCreateVote } from '../hooks/useCreateVote';
import { VISIBILITY_PUBLIC, VISIBILITY_UNLISTED, VISIBILITY_PRIVATE } from '../hooks/useVotes';

interface VoteFormData {
  title: string;
  description: string;
  visibility: number; // 0=Public, 1=Unlisted, 2=Private
  votingSystem: VotingSystem | null;
  options: string[];
}

interface CreateVoteFormProps {
  onVoteCreated?: (voteId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

const CreateVoteForm: React.FC<CreateVoteFormProps> = ({ onVoteCreated, onError, onCancel }) => {
  const { createVote, isCreating } = useCreateVote();
  const MAX_OPTIONS = 20;
  
  const [formData, setFormData] = useState<VoteFormData>({
    title: '',
    description: '',
    visibility: VISIBILITY_PUBLIC,
    votingSystem: null,
    options: ['', '']
  });

  const handleVisibilityChange = (visibility: number) => {
    setFormData(prev => ({ ...prev, visibility }));
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Refs pour gérer le focus
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Maintain single trailing empty option and auto-append within capacity
  useEffect(() => {
    setFormData(prev => {
      const opts = [...prev.options];
      // collapse multiple trailing empties into one
      while (opts.length > 1 && opts[opts.length - 1].trim() === '' && opts[opts.length - 2].trim() === '') {
        opts.pop();
      }
      // ensure an empty at the end if last is filled and capacity allows
      if (opts.length < MAX_OPTIONS) {
        if (opts.length === 0 || opts[opts.length - 1].trim() !== '') {
          opts.push('');
        }
      }
      // at least two rows for UX
      while (opts.length < 2) opts.push('');
      if (opts.join('\u0001') !== prev.options.join('\u0001')) {
        return { ...prev, options: opts };
      }
      return prev;
    });
  }, [formData.options]);

  const updateFormData = (updates: Partial<VoteFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    updateFormData({ options: newOptions });
  };

  // addOption removed: trailing empty option is auto-managed

  const removeOption = (index: number) => {
    // Do not remove the trailing empty row
    const isTrailingEmpty = index === formData.options.length - 1 && formData.options[index].trim() === '';
    if (isTrailingEmpty) return;
    const newOptions = formData.options.filter((_, i) => i !== index);
    updateFormData({ options: newOptions });
  };

  const handleOptionKeyPress = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (index < formData.options.length - 1) {
        // Sinon, passer à l'option suivante
        optionRefs.current[index + 1]?.focus();
      } else if (formData.options[index].trim() && formData.options.length < MAX_OPTIONS) {
        // If last and filled, create the next empty (QoL)
        const newOptions = [...formData.options, ''];
        updateFormData({ options: newOptions });
        setTimeout(() => {
          optionRefs.current[newOptions.length - 1]?.focus();
        }, 0);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'required';
    if (!formData.votingSystem) newErrors.votingSystem = 'required';
    const values = formData.options.map(o => o.trim());
    const nonEmpty = values.filter(o => o !== '');
    if (nonEmpty.length < 2) newErrors.options = 'min2';
    const lower = nonEmpty.map(s => s.toLowerCase());
    const seen = new Set<string>();
    for (const v of lower) {
      if (seen.has(v)) { newErrors.duplicates = 'dups'; break; }
      seen.add(v);
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      const result = await createVote({
        title: formData.title.trim(),
        description: formData.description,
        visibility: formData.visibility,
        votingSystem: formData.votingSystem as VotingSystem,
        options: nonEmpty
      });

      if (result.error) {
        setErrors({ submit: result.error });
        if (onError) onError(result.error);
        return;
      }

      setFormData({
        title: '',
        description: '',
        visibility: VISIBILITY_PUBLIC,
        votingSystem: null,
        options: ['', '']
      });
      setErrors({});
      setSubmitted(false);

      if (onVoteCreated && result.voteId) onVoteCreated(result.voteId);
    } catch (error) {
      console.error('Error while creating the vote:', error);
      const errorMessage = 'Error creating vote. Please try again.';
      setErrors({ submit: errorMessage });
      if (onError) onError(errorMessage);
    }
  };

  const canSubmit = !isCreating;
  const isTitleInvalid = submitted && !!errors.title;
  const isVotingInvalid = submitted && !!errors.votingSystem;

  const visibilityHelper = () => {
    switch (formData.visibility) {
      case VISIBILITY_PUBLIC: return 'Visible to everyone and listed publicly';
      case VISIBILITY_UNLISTED: return 'Accessible only via a shareable link';
      case VISIBILITY_PRIVATE: return 'Restricted access to authorized users';
      default: return '';
    }
  };

  const votingHelper = () => {
    switch (formData.votingSystem?.tag) {
      case 'Approval': return 'Simple and quick: approve the options you like.';
      case 'MajorityJudgment': return 'Rate each option with a mention for a nuanced decision.';
      default: return 'Choose a voting system.';
    }
  };

  const lastIndex = formData.options.length - 1;
  const lowerSeen = new Map<string, number>();
  const duplicateIdxs = new Set<number>();
  formData.options.forEach((opt, i) => {
    const val = opt.trim().toLowerCase();
    if (!val) return;
    if (lowerSeen.has(val)) {
      duplicateIdxs.add(i);
      duplicateIdxs.add(lowerSeen.get(val)!);
    } else {
      lowerSeen.set(val, i);
    }
  });

  return (
    <div id="create-vote-scroll" className="form-scroll">
      {/* Title removed since it's in modal header */}
      
      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div className="section" {...(isTitleInvalid ? { id: 'invalid-title' } : {})}>
          <label htmlFor="title" className="form-label">
            Vote title
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className="form-input"
            placeholder="e.g. Where should we go for team lunch?"
          />
          {/* No inline error text; border indicates missing after submit */}
        </div>

        {/* Description */}
        <div className="section">
          <label htmlFor="description" className="form-label">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            rows={3}
            className="form-textarea"
            placeholder="Additional information about this vote..."
          />
        </div>

        {/* Visibility */}
        <div className="section">
          <div className="bubble-section">
            <label className="form-label">Visibility</label>
            <select value={formData.visibility} onChange={(e) => handleVisibilityChange(Number(e.target.value))}>
              <option value={VISIBILITY_PUBLIC}>Public</option>
              <option value={VISIBILITY_UNLISTED}>Unlisted</option>
              <option value={VISIBILITY_PRIVATE}>Private</option>
            </select>
          </div>
          <div className="helper">{visibilityHelper()}</div>
        </div>

        {/* Voting system */}
        <div className="section">
          <div className="bubble-section">
            <label className="form-label">Voting system</label>
            <div className="bubble-group" {...(isVotingInvalid ? { id: 'invalid-vsystem' } : {})}>
            {[
              { key: 'Approval', label: 'Approval', value: VotingSystem.Approval as VotingSystem },
              { key: 'MajorityJudgment', label: 'Majority judgment', value: VotingSystem.MajorityJudgment as VotingSystem },
            ].map((v) => {
              const active = formData.votingSystem?.tag === v.key;
              return (
                <button
                  type="button"
                  key={v.key}
                  onClick={() => updateFormData({ votingSystem: v.value })}
                  className="bubble"
                  {...(active ? { id: `active-${v.key.toLowerCase()}` } : {})}
                  aria-pressed={active}
                >
                  {v.label}
                </button>
              );
            })}
            </div>
          </div>
          <div className="helper">{votingHelper()}</div>
        </div>

        {/* Options */}
        <div className="section">
          <label className="form-label">Options</label>
          <div className="options-list">
            {formData.options.map((option, index) => {
              const isTrailingEmpty = index === lastIndex && option.trim() === '';
              const isEmptyInvalid = submitted && !isTrailingEmpty && option.trim() === '';
              const isDupInvalid = submitted && duplicateIdxs.has(index);
              const invalid = isEmptyInvalid || isDupInvalid;
              const showDelete = !isTrailingEmpty;
              return (
                <div key={index} className="option-row" {...(invalid ? { id: `invalid-option-${index}` } : {})}>
                  <input
                    ref={(el) => optionRefs.current[index] = el}
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    onKeyPress={(e) => handleOptionKeyPress(index, e)}
                    className="form-input"
                    placeholder={`Option ${index + 1}`}
                  />
                  {showDelete && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="btn-danger"
                      id="circle"
                      title="Delete this option"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Erreur de soumission */}
        {errors.submit && (
          <div className="error-box">
            <p>{errors.submit}</p>
          </div>
        )}

        {/* Modal Footer with Buttons */}
        <div className="modal-footer">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || isCreating}
            className="btn"
          >
            {isCreating ? 'Creating...' : 'Create vote'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateVoteForm;
