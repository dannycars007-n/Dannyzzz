import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0d] text-zinc-400" data-testid="auth-loading">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#ff3d00] border-t-transparent rounded-full animate-spin"></div>
          <span>Verificando sesión...</span>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
}
