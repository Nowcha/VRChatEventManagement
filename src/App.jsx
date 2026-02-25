import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ShiftsPage from './pages/ShiftsPage'
import CustomersPage from './pages/CustomersPage'
import FeedbacksPage from './pages/FeedbacksPage'
import GalleryPage from './pages/GalleryPage'
import SettingsPage from './pages/SettingsPage'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-spinner" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

function PublicRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="loading-spinner" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        )
    }

    if (user) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <LoginPage />
                    </PublicRoute>
                }
            />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="shifts" element={<ShiftsPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="feedbacks" element={<FeedbacksPage />} />
                <Route path="gallery" element={<GalleryPage />} />
                <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <Router>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </Router>
    )
}
