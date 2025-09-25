import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import CreateVotePage from './pages/CreateVotePage';
import ApprovalViewPage from './pages/ApprovalViewPage';
import ApprovalVotePage from './pages/ApprovalVotePage';
import JudgmentViewPage from './pages/JudgmentViewPage';
import JudgmentVotePage from './pages/JudgmentVotePage';
import LegacyVoteRedirect from './pages/LegacyVoteRedirect';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreateVotePage />} />
        <Route path="/approval/view" element={<ApprovalViewPage />} />
        <Route path="/approval/vote" element={<ApprovalVotePage />} />
        <Route path="/judgment/view" element={<JudgmentViewPage />} />
        <Route path="/judgment/vote" element={<JudgmentVotePage />} />
        <Route path="/vote/:token" element={<LegacyVoteRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default AppRouter;
