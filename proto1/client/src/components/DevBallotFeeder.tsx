import React, { useState } from 'react';
import { spacetimeDB } from '../lib/spacetimeClient';
import { VoteWithOptions } from '../hooks/useVotes';
import { Mention } from '../generated/mention_type';
import { useToast } from './ToastProvider';

interface DevBallotFeederProps {
  vote: VoteWithOptions;
}

// A small helper to pause execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DevBallotFeeder: React.FC<DevBallotFeederProps> = ({ vote }) => {
  const [isFeeding, setIsFeeding] = useState(false);
  const [feedAmount, setFeedAmount] = useState('10');
  const [feedProgress, setFeedProgress] = useState(0);
  const { showToast } = useToast();

  const handleFeedBallots = async () => {
    const amount = parseInt(feedAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      showToast({ type: 'error', message: 'Please enter a valid number of ballots.' });
      return;
    }

    setIsFeeding(true);
    setFeedProgress(0);

    for (let i = 0; i < amount; i++) {
      setFeedProgress(i + 1);
      
      // 1. Reset identity to simulate a new user and wait for reconnect
      spacetimeDB.resetIdentity();
      let attempts = 0;
      while (!spacetimeDB.connection) {
        if (attempts > 50) { // 5-second timeout
          showToast({ type: 'error', message: 'Connection timeout after reset. Aborting.' });
          setIsFeeding(false);
          return;
        }
        await sleep(100);
        attempts++;
      }

      // 2. Create and submit a full random ballot for the new user
      try {
        const mentions = [
          Mention.ToReject,
          Mention.Insufficient, 
          Mention.OnlyAverage,
          Mention.GoodEnough,
          Mention.Good,
          Mention.VeryGood,
          Mention.Excellent
        ];
        console.log(`Submitting ballot ${i + 1} for new identity...`);
        for (const option of vote.options || []) {
          const randomMention = mentions[Math.floor(Math.random() * mentions.length)];
          await spacetimeDB.call('submit_judgment_ballot', option.id, randomMention);
        }
        // Add a small delay for the reducers to process before the next user
        await sleep(100);
      } catch (e) {
        console.error(`Failed to submit ballot ${i + 1}:`, e);
        showToast({ type: 'error', message: `Failed on ballot ${i + 1}. Check console.` });
        break; // Stop on error
      }
    }

    setIsFeeding(false);
    showToast({ type: 'success', message: `${amount} ballots submitted successfully!` });
  };

  return (
    <div className="dev-panel" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
      <h4>🤖 Ballot Feeder (Dev Tool)</h4>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>This tool simulates multiple users casting random ballots. To remove, delete this component file and its import.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <input
          type="number"
          value={feedAmount}
          onChange={(e) => setFeedAmount(e.target.value)}
          disabled={isFeeding}
          style={{ width: '80px' }}
        />
        <button onClick={handleFeedBallots} disabled={isFeeding || !vote.options || vote.options.length === 0}>
          {isFeeding ? `Submitting... (${feedProgress}/${feedAmount})` : 'Start Feeding'}
        </button>
      </div>
      {isFeeding && (
        <progress value={feedProgress} max={feedAmount} style={{ width: '100%', marginTop: '1rem' }}></progress>
      )}
    </div>
  );
};

export default DevBallotFeeder;
