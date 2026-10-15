import { lazy, Suspense } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router';
import CreatePollPage from '../polls/CreatePollPage';
import HomePage from '../polls/HomePage';
import PollPage from '../polls/PollPage';
import { PreferencesProvider } from '../preferences/preferences';
import { ToastProvider } from '../ui/Toasts';
import AboutPage from './AboutPage';
import Footer from './Footer';
import Header from './Header';
import NotFoundPage from './NotFoundPage';

/** Loaded when opened: the world map is most of its weight, and few visitors open it. */
const StatisticsPage = lazy(() => import('../statistics/StatisticsPage'));

/**
 * Three screens: the polls you can see, a form to create one, and a poll -
 * where you vote and watch the results come in. A poll's address, /p/<id>,
 * is its share link. /about says how results are decided, and why;
 * /statistics, how much zvote is used, and where.
 */
export default function App() {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="new" element={<CreatePollPage />} />
              <Route path="p/:id" element={<PollPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route
                path="statistics"
                element={(
                  <Suspense fallback={<p className="empty" aria-busy="true">Loading…</p>}>
                    <StatisticsPage />
                  </Suspense>
                )}
              />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </PreferencesProvider>
  );
}

function Layout() {
  return (
    <>
      <Header />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
