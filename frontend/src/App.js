import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage   from './pages/ProfilePage';
import SettingsPage  from './pages/SettingsPage';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-primary)',
        color: 'var(--text-3)', fontFamily: 'Inter, sans-serif', gap: 10,
      }}>
        <div className="spinner" style={{ marginRight: 6 }} />
        Loading WHY Engine...
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
              <Protected><WorkspacePage /></Protected>
            } />
            <Route path="/dashboard" element={
              <Protected><DashboardPage /></Protected>
            } />
            <Route path="/profile" element={
              <Protected><ProfilePage /></Protected>
            } />
            <Route path="/settings" element={
              <Protected><SettingsPage /></Protected>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
