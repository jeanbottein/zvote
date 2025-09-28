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
}

const CreateVoteForm: React.FC<CreateVoteFormProps> = ({ onVoteCreated, onError }) => {
  const { createVote, isCreating } = useCreateVote();
  const MAX_OPTIONS = 20;
  
  const [formData, setFormData] = useState<VoteFormData>({
    title: '',
    description: '',
    visibility: VISIBILITY_UNLISTED,
    votingSystem: VotingSystem.MajorityJudgment as VotingSystem,
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

      // Don't reset form on success - let parent handle navigation
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
    <div className="create-vote-form">
      <div className="form-panel main-panel">
        <h2 className="main-panel-title">New Vote</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Title - inline with label */}
          <div className="title-section">
            <label htmlFor="title" className="title-label">Title:</label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData({ title: e.target.value })}
              className={`title-input ${isTitleInvalid ? 'invalid' : ''}`}
              placeholder="Enter vote title"
            />
          </div>

          {/* Visibility - inline with explanation */}
          <div className="inline-section">
            <div className="inline-header">
              <label className="inline-label">Visibility:</label>
              <div className="inline-buttons">
                {[
                  { key: VISIBILITY_UNLISTED, label: 'Unlisted' },
                  { key: VISIBILITY_PUBLIC, label: 'Public' },
                  { key: VISIBILITY_PRIVATE, label: 'Private' },
                ].map((v) => {
                  const active = formData.visibility === v.key;
                  return (
                    <button
                      type="button"
                      key={v.key}
                      onClick={() => handleVisibilityChange(v.key)}
                      className={`inline-choice-button ${active ? 'active' : ''}`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="inline-explanation">
              {formData.visibility === VISIBILITY_PUBLIC && "Visible to everyone and listed publicly"}
              {formData.visibility === VISIBILITY_UNLISTED && "Accessible only via shareable link"}
              {formData.visibility === VISIBILITY_PRIVATE && "Restricted access to authorized users"}
            </div>
          </div>

          {/* Voting System - inline with explanation */}
          <div className="inline-section">
            <div className="inline-header">
              <label className="inline-label">Voting System:</label>
              <div className="inline-buttons">
                {[
                  { key: 'MajorityJudgment', label: 'Majority Judgment', value: VotingSystem.MajorityJudgment as VotingSystem },
                  { key: 'Approval', label: 'Approval', value: VotingSystem.Approval as VotingSystem },
                ].map((v) => {
                  const active = formData.votingSystem?.tag === v.key;
                  return (
                    <button
                      type="button"
                      key={v.key}
                      onClick={() => updateFormData({ votingSystem: v.value })}
                      className={`inline-choice-button ${active ? 'active' : ''} ${isVotingInvalid ? 'invalid' : ''}`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="inline-explanation">
              {formData.votingSystem?.tag === 'Approval' && "Simple and quick: approve the options you like"}
              {formData.votingSystem?.tag === 'MajorityJudgment' && "Rate each option with a mention for nuanced decisions"}
            </div>
          </div>

          {/* Options */}
          <div className="options-section">
            <h3 className="section-title">Options</h3>
            <div className="options-list">
              {formData.options.map((option, index) => {
                const isTrailingEmpty = index === lastIndex && option.trim() === '';
                const isEmptyInvalid = submitted && !isTrailingEmpty && option.trim() === '';
                const isDupInvalid = submitted && duplicateIdxs.has(index);
                const invalid = isEmptyInvalid || isDupInvalid;
                const showDelete = !isTrailingEmpty;
                return (
                  <div key={index} className="option-row">
                    <input
                      ref={(el) => optionRefs.current[index] = el}
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      onKeyPress={(e) => handleOptionKeyPress(index, e)}
                      className={`option-input ${invalid ? 'invalid' : ''}`}
                      placeholder={`Option ${index + 1}`}
                    />
                    {showDelete ? (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="delete-button"
                        title="Delete this option"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="delete-button-placeholder"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="error-message">
              {errors.submit}
            </div>
          )}

          {/* Big Create Button */}
          <div className="create-button-container">
            <button
              type="submit"
              disabled={!canSubmit || isCreating}
              className="create-button"
            >
              {isCreating ? (
                <span className="button-spinner">
                  <span className="spinner"></span>
                  Creating...
                </span>
              ) : (
                'Create Vote'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateVoteForm;
