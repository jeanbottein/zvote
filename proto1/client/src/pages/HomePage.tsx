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
      <div id="home-panel-my" className="panel">
        <div id="home-panel-head-my" className="panel-head">
          <h2 id="home-panel-title-my" className="panel-head-title">My votes</h2>
          <button id="home-create-btn" onClick={() => navigate('/create')}>+ Create vote</button>
        </div>
        <VotesList
          votes={myVotes}
          isLoading={isLoading}
          error={error}
          onVoteClick={goToView}
          onVoteButtonClick={goToVote}
          emptyMessage="You haven't created any votes yet."
        />
      </div>

      {/* Public Votes */}
      <div id="home-panel-public" className="panel">
        <div id="home-panel-head-public" className="panel-head">
          <h2 id="home-panel-title-public" className="panel-head-title">Public votes</h2>
        </div>
        <VotesList
          votes={publicVotes}
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
