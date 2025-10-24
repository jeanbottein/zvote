import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackend } from '../lib/backend';
import { useToast } from './ToastProvider';

interface DeleteVoteButtonProps {
  voteId: string;
  voteCreator: string;
  voteTitle: string;
}

const DeleteVoteButton: React.FC<DeleteVoteButtonProps> = ({ voteId, voteCreator, voteTitle }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Check if current user is the owner using backend abstraction
  useEffect(() => {
    const checkOwnership = async () => {
      try {
        const backend = await getBackend();
        const isOwner = await backend.isVoteOwner(voteId, voteCreator);
        
        console.debug('[DeleteVoteButton] Ownership check:', {
          voteId,
          voteCreator,
          isOwner
        });

        setIsOwner(isOwner);
      } catch (error) {
        console.error('[DeleteVoteButton] Error checking ownership:', error);
        setIsOwner(false);
      }
    };

    checkOwnership();
  }, [voteId, voteCreator]);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      // Use backend abstraction instead of direct reducer call
      const backend = await getBackend();
      await backend.deleteVote(voteId);
      
      // Navigate back to home after successful deletion
      setTimeout(() => {
        navigate('/');
      }, 300);
    } catch (error) {
      console.error('Error deleting vote:', error);
      showToast({ 
        type: 'error', 
        message: 'Failed to delete vote. You may not have permission.' 
      });
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  // Don't render if not owner
  if (!isOwner) {
    return null;
  }

  return (
    <div className="delete-vote-section">
      {!showConfirm ? (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn-delete-vote"
          title="Delete this vote"
        >
          🗑️ Delete Vote
        </button>
      ) : (
        <div className="delete-confirm-container">
          <p className="delete-confirm-message">
            Are you sure you want to delete "<strong>{voteTitle}</strong>"?
            <br />
            <span className="delete-warning">This action cannot be undone.</span>
          </p>
          <div className="delete-confirm-buttons">
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn-confirm-delete"
            >
              {isDeleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteVoteButton;
