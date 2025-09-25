import React from 'react';
import { useNavigate } from 'react-router-dom';
import VotesList from '../components/VotesList';
import { useVotes, VoteWithOptions } from '../hooks/useVotes';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { myVotes, publicVotes, isLoading, error } = useVotes();

  const goToView = (vote: VoteWithOptions) => {
    const token = vote.token;
    const system = typeof vote.voting_system === 'string' ? vote.voting_system : vote.voting_system?.tag;
    if (!token) return;
    if (system === 'Approval') navigate(`/approval/view?token=${encodeURIComponent(token)}`);
    else if (system === 'MajorityJudgment') navigate(`/judgment/view?token=${encodeURIComponent(token)}`);
  };

  const goToVote = (vote: VoteWithOptions) => {
    const token = vote.token;
    const system = typeof vote.voting_system === 'string' ? vote.voting_system : vote.voting_system?.tag;
    if (!token) return;
    if (system === 'Approval') navigate(`/approval/vote?token=${encodeURIComponent(token)}`);
    else if (system === 'MajorityJudgment') navigate(`/judgment/vote?token=${encodeURIComponent(token)}`);
  };

  return (
    <>
      {/* My Votes */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>My votes</h2>
          <button onClick={() => navigate('/create')}>
            + Create vote
          </button>
        </div>
        <VotesList
          votes={myVotes}
          title="My votes"
          isLoading={isLoading}
          error={error}
          onVoteClick={goToView}
          onVoteButtonClick={goToVote}
          emptyMessage="You haven't created any votes yet."
          onCreateClick={() => navigate('/create')}
        />
      </div>

      {/* Public Votes */}
      <div className="panel">
        <h2>Public votes</h2>
        <VotesList
          votes={publicVotes}
          title="Public votes"
          isLoading={isLoading}
          error={error}
          onVoteClick={goToView}
          onVoteButtonClick={goToVote}
          emptyMessage="No public votes available."
        />
      </div>
    </>
  );
};

export default HomePage;
