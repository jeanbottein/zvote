import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spacetimeDB } from '../lib/spacetimeClient';
import { useToast } from './ToastProvider';
import { deepEqual } from 'spacetimedb';

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

  // Check if current user is the owner - use same logic as useVotes
  useEffect(() => {
    const checkOwnership = () => {
      if (!spacetimeDB.currentUser || !spacetimeDB.connection) {
        setIsOwner(false);
        return;
      }

      try {
        // Get the vote from the database to access raw creator object
        const db = spacetimeDB.connection.db as any;
        const voteIdNum = parseInt(voteId, 10);
        
        if (isNaN(voteIdNum)) {
          setIsOwner(false);
          return;
        }

        const vote = db.vote.id.find(voteIdNum);
        
        if (!vote) {
          setIsOwner(false);
          return;
        }

        // Use the exact same comparison logic as useVotes hook
        const normalizeId = (s: string) => {
          const m = s?.toString?.().match(/0x([0-9a-f]+)/i);
          return m ? m[1].toLowerCase() : s?.toString?.().toLowerCase?.() || '';
        };

        const idObj = spacetimeDB.identityObject;
        const rawCurrent = idObj?.toString?.() || spacetimeDB.currentUser.identity;
        
        // Try deepEqual first (most reliable), then fall back to normalized string comparison
        const isMine = vote.creator && idObj 
          ? deepEqual(vote.creator, idObj)
          : normalizeId(vote.creator?.toString?.() || voteCreator) === normalizeId(rawCurrent);

        console.debug('[DeleteVoteButton] Ownership check:', {
          voteId,
          voteCreator: vote.creator?.toString?.(),
          currentUser: rawCurrent,
          isMine,
          method: vote.creator && idObj ? 'deepEqual' : 'normalized'
        });

        setIsOwner(isMine);
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
      // Convert string ID to number for the reducer
      const voteIdNum = parseInt(voteId, 10);
      if (isNaN(voteIdNum)) {
        throw new Error('Invalid vote ID');
      }

      spacetimeDB.reducers.deleteVote(voteIdNum);
      
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
