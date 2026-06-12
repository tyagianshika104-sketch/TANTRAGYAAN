import { Navigate, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DiscoverStartups from './pages/DiscoverStartups';
import CVScore from './pages/CVScore';
import EmailDrafts from './pages/EmailDrafts';
import MyApplications from './pages/MyApplications';
import Settings from './pages/Settings';
import { useAuth } from './lib/auth';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { profile, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background text-zinc-400 grid place-items-center">Loading...</div>;
  }

  return profile ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="discover" element={<DiscoverStartups />} />
        <Route path="cv-score" element={<CVScore />} />
        <Route path="email-drafts" element={<EmailDrafts />} />
        <Route path="applications" element={<MyApplications />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default App;
