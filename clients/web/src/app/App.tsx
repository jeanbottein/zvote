import { BrowserRouter, Outlet, Route, Routes } from 'react-router';
import CreatePollPage from '../polls/CreatePollPage';
import HomePage from '../polls/HomePage';
import PollPage from '../polls/PollPage';
import { PreferencesProvider } from '../preferences/preferences';
import { ToastProvider } from '../ui/Toasts';
import Header from './Header';
import NotFoundPage from './NotFoundPage';

/**
 * Three screens: the polls you can see, a form to create one, and a poll -
 * where you vote and watch the results come in. A poll's address, /p/<id>,
 * is its share link.
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
    </>
  );
}
