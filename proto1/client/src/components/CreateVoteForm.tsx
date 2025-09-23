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
  
  const [formData, setFormData] = useState<VoteFormData>({
    title: '',
    description: '',
    visibility: Visibility.Public as Visibility,
    votingSystem: null,
    options: ['', '']
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs pour gérer le focus
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Validation en temps réel
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    // Validation du titre
    if (!formData.title.trim()) {
      newErrors.title = 'Le titre est obligatoire';
    }

    // Validation du système de vote
    if (!formData.votingSystem) {
      newErrors.votingSystem = 'Vous devez choisir un système de vote';
    }

    // Validation des options
    const validOptions = formData.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      newErrors.options = 'Au moins 2 options sont requises';
    }

    // Vérification des doublons
    const uniqueOptions = new Set(validOptions.map(opt => opt.trim().toLowerCase()));
    if (uniqueOptions.size !== validOptions.length) {
      newErrors.duplicates = 'Les options doivent être uniques';
    }

    setErrors(newErrors);
  }, [formData]);

  const updateFormData = (updates: Partial<VoteFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    updateFormData({ options: newOptions });
  };

  const addOption = () => {
    const newOptions = [...formData.options, ''];
    updateFormData({ options: newOptions });
    
    // Focus sur la nouvelle option après le render
    setTimeout(() => {
      const lastIndex = newOptions.length - 1;
      optionRefs.current[lastIndex]?.focus();
    }, 0);
  };

  const removeOption = (index: number) => {
    if (formData.options.length <= 2) return;
    
    const newOptions = formData.options.filter((_, i) => i !== index);
    updateFormData({ options: newOptions });
  };

  const handleOptionKeyPress = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // Si c'est la dernière option et qu'elle n'est pas vide, ajouter une nouvelle
      if (index === formData.options.length - 1 && formData.options[index].trim()) {
        addOption();
      } else if (index < formData.options.length - 1) {
        // Sinon, passer à l'option suivante
        optionRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (Object.keys(errors).length > 0 || !formData.votingSystem) {
      return;
    }

    try {
      const result = await createVote({
        title: formData.title.trim(),
        description: formData.description,
        visibility: formData.visibility,
        votingSystem: formData.votingSystem,
        options: formData.options
      });

      if (result.error) {
        setErrors({ submit: result.error });
        if (onError) {
          onError(result.error);
        }
        return;
      }

      // Reset du formulaire en cas de succès
      setFormData({
        title: '',
        description: '',
        visibility: Visibility.Public as Visibility,
        votingSystem: null,
        options: ['', '']
      });
      setErrors({});

      // Callback de succès
      if (onVoteCreated && result.voteId) {
        onVoteCreated(result.voteId);
      }

    } catch (error) {
      console.error('Erreur lors de la création du vote:', error);
      const errorMessage = 'Error creating vote. Please try again.';
      setErrors({ submit: errorMessage });
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const canSubmit = Object.keys(errors).length === 0 && formData.title.trim() && formData.votingSystem;

  return (
    <div>
      {/* Title removed since it's in modal header */}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Titre */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Titre du vote *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => updateFormData({ title: e.target.value })}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ex: Quel restaurant pour le déjeuner d'équipe ?"
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description (optionnelle)
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => updateFormData({ description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Informations complémentaires sur le vote..."
          />
        </div>

        {/* Visibilité */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visibilité du vote
          </label>
          <div className="space-y-2">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="Public"
                checked={formData.visibility?.tag === 'Public'}
                onChange={() => updateFormData({ visibility: Visibility.Public as Visibility })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Public</div>
                <div className="text-sm text-gray-500">Visible par tous, accessible via la liste publique</div>
              </div>
            </label>
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="Unlisted"
                checked={formData.visibility?.tag === 'Unlisted'}
                onChange={() => updateFormData({ visibility: Visibility.Unlisted as Visibility })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Non-listé</div>
                <div className="text-sm text-gray-500">Accessible uniquement via le lien de partage</div>
              </div>
            </label>
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="Private"
                checked={formData.visibility?.tag === 'Private'}
                onChange={() => updateFormData({ visibility: Visibility.Private as Visibility })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Privé</div>
                <div className="text-sm text-gray-500">Accès restreint aux personnes autorisées</div>
              </div>
            </label>
          </div>
        </div>

        {/* Système de vote */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Système de vote *
          </label>
          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer p-3 border rounded-md hover:bg-gray-50">
              <input
                type="radio"
                name="votingSystem"
                value="Approval"
                checked={formData.votingSystem?.tag === 'Approval'}
                onChange={() => updateFormData({ votingSystem: VotingSystem.Approval as VotingSystem })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Vote par approbation</div>
                <div className="text-sm text-gray-600 italic">
                  Idéal pour sa simplicité : les participants approuvent ou non chaque option. 
                  Parfait pour des choix multiples rapides.
                </div>
              </div>
            </label>
            
            <label className="flex items-start space-x-3 cursor-pointer p-3 border rounded-md hover:bg-gray-50">
              <input
                type="radio"
                name="votingSystem"
                value="MajorityJudgment"
                checked={formData.votingSystem?.tag === 'MajorityJudgment'}
                onChange={() => updateFormData({ votingSystem: VotingSystem.MajorityJudgment as VotingSystem })}
                className="mt-1"
              />
              <div>
                <div className="font-medium">Jugement majoritaire</div>
                <div className="text-sm text-gray-600 italic">
                  Privilégie la qualité du choix : chaque option reçoit une mention qualitative. 
                  Excellent pour des décisions importantes nécessitant une évaluation nuancée.
                </div>
              </div>
            </label>
          </div>
          {errors.votingSystem && (
            <p className="mt-1 text-sm text-red-600">{errors.votingSystem}</p>
          )}
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Options du vote * (minimum 2)
          </label>
          <div className="space-y-2">
            {formData.options.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 w-8">
                  {index + 1}.
                </span>
                <input
                  ref={(el) => optionRefs.current[index] = el}
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  onKeyPress={(e) => handleOptionKeyPress(index, e)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Option ${index + 1}`}
                />
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                    title="Supprimer cette option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={addOption}
            className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-200"
          >
            + Ajouter une option
          </button>
          
          {(errors.options || errors.duplicates) && (
            <div className="mt-1 text-sm text-red-600">
              {errors.options}
              {errors.duplicates && <div>{errors.duplicates}</div>}
            </div>
          )}
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
