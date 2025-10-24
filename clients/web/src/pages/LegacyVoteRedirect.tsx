import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useVoteByToken } from '../hooks/useVoteByToken';

const LegacyVoteRedirect: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { vote, loading } = useVoteByToken(token || null);

  useEffect(() => {
    if (!token) return;
    if (loading) return;
    if (!vote) return; // could show error, but let other pages handle

    const system = typeof vote.voting_system === 'string' ? vote.voting_system : vote.voting_system?.tag;
    if (system === 'Approval') {
      navigate(`/approval/view?token=${encodeURIComponent(token)}`, { replace: true });
    } else {
      navigate(`/judgment/view?token=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [token, loading, vote, navigate]);

  return (
    <div className="panel">
      <h2>Loading vote…</h2>
    </div>
  );
};

export default LegacyVoteRedirect;
