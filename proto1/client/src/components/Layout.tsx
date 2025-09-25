import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { ToastProvider } from './ToastProvider';

const Layout: React.FC = () => {
  return (
    <ToastProvider>
      <Header />
      <main>
        <Outlet />
      </main>
    </ToastProvider>
  );
};

export default Layout;
