import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { PreferencesProvider } from '../preferences/preferences';
import { ToastProvider } from '../ui/Toasts';

/** Renders a page at a path, inside the providers the app gives it. */
export function renderAt(path: string, routes: { path: string; element: ReactNode }[]) {
  return render(
    <PreferencesProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            {routes.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
            <Route path="/p/:id" element={<ShownPoll />} />
            <Route path="/" element={<p>Home page</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </PreferencesProvider>,
  );
}

/** Stands in for the poll page, to check where a page navigated to. */
function ShownPoll() {
  return <p>Poll page {useParams().id}</p>;
}
