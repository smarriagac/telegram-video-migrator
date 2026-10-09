import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../features/auth/application/useAuthStore";
import { Role } from "../features/auth/domain/types";
import { ShieldAlert } from "lucide-react";

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    if (token && !user) {
      checkAuth();
    }
  }, [token, user, checkAuth]);

  if (!token && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user role check is required and user info is loaded
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="p-8 max-w-md mx-auto my-12 bg-[#14161F] border border-rose-500/20 rounded-3xl text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-white">Acceso Restringido</h2>
        <p className="text-xs text-zinc-400">
          Tu rol asignado (<span className="font-mono text-rose-400 font-bold">{user.role}</span>) no cuenta con permisos para operar este módulo.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
