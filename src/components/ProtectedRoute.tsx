import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = () => {
    const { session, loading } = useAuth();

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>; // Or a nice spinner
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};
