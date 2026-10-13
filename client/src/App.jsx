import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { UserAuthProvider } from './hooks/useUserAuth';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import RequireUser from './components/RequireUser';
import AdminLayout from './components/AdminLayout';
import PublicLayout from './components/PublicLayout';

// Landing + login (both user and staff)
import LandingPage from './pages/LandingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Public website
import HomePage from './pages/public/HomePage';
import BloodAvailabilityPage from './pages/public/BloodAvailabilityPage';
import RequestBloodPage from './pages/public/RequestBloodPage';
import TrackStatusPage from './pages/public/TrackStatusPage';
import DonatePage from './pages/public/DonatePage';
import UserSignupPage from './pages/public/UserSignupPage';
import AccountPage from './pages/public/AccountPage';

// Admin panel
import DashboardPage from './pages/admin/DashboardPage';
import DonorsPage from './pages/admin/DonorsPage';
import DonationsPage from './pages/admin/DonationsPage';
import PatientsPage from './pages/admin/PatientsPage';
import RequestsPage from './pages/admin/RequestsPage';
import IssuesPage from './pages/admin/IssuesPage';

function App() {
  return (
    <AuthProvider>
      <UserAuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Landing page doubles as the login page. key makes each route start with fresh form state */}
              <Route path="/" element={<LandingPage key="user" role="user" />} />
              <Route path="/login" element={<LandingPage key="user" role="user" />} />
              <Route path="/admin/login" element={<LandingPage key="admin" role="admin" />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Public website */}
              <Route element={<PublicLayout />}>
                <Route path="home" element={<HomePage />} />
                <Route path="availability" element={<BloodAvailabilityPage />} />
                <Route path="signup" element={<UserSignupPage />} />

                {/* Need a public account */}
                <Route element={<RequireUser />}>
                  <Route path="donate" element={<DonatePage />} />
                  <Route path="request-blood" element={<RequestBloodPage />} />
                  <Route path="track" element={<TrackStatusPage />} />
                  <Route path="account" element={<AccountPage />} />
                </Route>
              </Route>
              <Route path="/register-donor" element={<Navigate to="/donate" replace />} />

              {/* Admin panel */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="donors" element={<DonorsPage />} />
                <Route path="donations" element={<DonationsPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="issues" element={<IssuesPage />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </UserAuthProvider>
    </AuthProvider>
  );
}

export default App;
