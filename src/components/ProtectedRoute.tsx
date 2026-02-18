import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requiredRole?: "admin" | "employee";
}> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={requiredRole === "admin" ? "/admin/login" : "/login"} replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={profile?.role === "admin" ? "/admin" : "/employee"} replace />;
  }

  return <>{children}</>;
};
