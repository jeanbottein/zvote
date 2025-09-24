import React, { useState, useEffect, useRef } from 'react';
import { VotingSystem, Visibility } from '../generated/index';
import { useCreateVote } from '../hooks/useCreateVote';

interface VoteFormData {
  title: string;
  description: string;
  visibility: Visibility;
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
    visibility: Visibility.Public as Visibility,
    votingSystem: null,
    options: ['', '']
  });

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
        visibility: Visibility.Public as Visibility,
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
    switch (formData.visibility?.tag) {
      case 'Public': return 'Visible to everyone and listed publicly';
      case 'Unlisted': return 'Accessible only via a shareable link';
      case 'Private': return 'Restricted access to authorized users';
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
    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
      {/* Title removed since it's in modal header */}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Vote title
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isTitleInvalid ? 'border-red-500' : 'border-gray-300'}`}
            placeholder="e.g. Where should we go for team lunch?"
          />
          {/* No inline error text; border indicates missing after submit */}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Additional information about this vote..."
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
          <div className="flex items-center gap-3">
            {[
              { key: 'Public', label: 'Public', value: Visibility.Public as Visibility },
              { key: 'Unlisted', label: 'Unlisted', value: Visibility.Unlisted as Visibility },
              { key: 'Private', label: 'Private', value: Visibility.Private as Visibility },
            ].map((v) => {
              const active = formData.visibility?.tag === v.key;
              return (
                <button
                  type="button"
                  key={v.key}
                  onClick={() => updateFormData({ visibility: v.value })}
                  className={`px-4 py-2 text-sm rounded-full border-2 font-medium transition-all duration-200 ${active ? 'bg-blue-100 text-blue-800 border-blue-400 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                  aria-pressed={active}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <div className="mt-1 text-sm text-gray-600 italic">{visibilityHelper()}</div>
        </div>

        {/* Voting system */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Voting system</label>
          <div className={`flex items-center gap-3 ${isVotingInvalid ? 'ring-2 ring-red-400 rounded-lg p-2' : ''}`}>
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
                  className={`px-4 py-2 text-sm rounded-full border-2 font-medium transition-all duration-200 ${active ? 'bg-blue-100 text-blue-800 border-blue-400 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                  aria-pressed={active}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
          <div className="mt-1 text-sm text-gray-600 italic">{votingHelper()}</div>
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          <div className="space-y-2">
            {formData.options.map((option, index) => {
              const isTrailingEmpty = index === lastIndex && option.trim() === '';
              const isEmptyInvalid = submitted && !isTrailingEmpty && option.trim() === '';
              const isDupInvalid = submitted && duplicateIdxs.has(index);
              const invalid = isEmptyInvalid || isDupInvalid;
              const showDelete = !isTrailingEmpty;
              return (
                <div key={index} className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                  <input
                    ref={(el) => optionRefs.current[index] = el}
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    onKeyPress={(e) => handleOptionKeyPress(index, e)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${invalid ? 'border-red-500' : 'border-gray-300'}`}
                    style={{ width: '90%' }}
                    placeholder={`Option ${index + 1}`}
                  />
                  {showDelete && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors duration-200"
                      style={{ fontSize: '18px', fontWeight: 'bold' }}
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
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Modal Footer with Buttons */}
        <div className="modal-footer">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="secondary"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create vote'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateVoteForm;
