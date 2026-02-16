import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import LoginPage from "@/pages/LoginPage";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import PunchInPage from "@/pages/employee/PunchInPage";
import ApplyLeavePage from "@/pages/employee/ApplyLeavePage";
import EmployeeMonthlyReport from "@/pages/employee/EmployeeMonthlyReport";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AddEmployeePage from "@/pages/admin/AddEmployeePage";
import AttendanceOverview from "@/pages/admin/AttendanceOverview";
import LeaveApprovalPage from "@/pages/admin/LeaveApprovalPage";
import AdminMonthlyReports from "@/pages/admin/AdminMonthlyReports";
import NotificationsPage from "@/pages/NotificationsPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const HomeRedirect = () => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={profile?.role === "admin" ? "/admin" : "/employee"} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Employee Routes */}
            <Route path="/employee" element={<ProtectedRoute requiredRole="employee"><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<EmployeeDashboard />} />
              <Route path="punch" element={<PunchInPage />} />
              <Route path="leave" element={<ApplyLeavePage />} />
              <Route path="report" element={<EmployeeMonthlyReport />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="add-employee" element={<AddEmployeePage />} />
              <Route path="attendance" element={<AttendanceOverview />} />
              <Route path="leaves" element={<LeaveApprovalPage />} />
              <Route path="reports" element={<AdminMonthlyReports />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
