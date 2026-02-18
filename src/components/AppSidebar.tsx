import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  FileBarChart,
  LogOut,
  Leaf,
  UserPlus,
  Users,
  CheckCircle,
  Bell,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const employeeLinks = [
  { to: "/employee", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employee/punch", icon: Clock, label: "Punch In" },
  { to: "/employee/leave", icon: CalendarDays, label: "Apply Leave" },
  { to: "/employee/report", icon: FileBarChart, label: "My Monthly Report" },
];

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/employees", icon: Users, label: "Employees" },
  { to: "/admin/attendance", icon: Users, label: "Attendance Overview" },
  { to: "/admin/leaves", icon: CheckCircle, label: "Leave Approval" },
  { to: "/admin/reports", icon: FileBarChart, label: "Monthly Reports" },
];

const AppSidebar = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === "admin";
  const links = isAdmin ? adminLinks : employeeLinks;
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.user_id)
        .eq("read_status", false);
      setUnread(count || 0);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [profile]);

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <Leaf className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold">Vaazhai</h1>
          <p className="text-xs text-sidebar-foreground/60 capitalize">{profile?.role} Panel</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`sidebar-link ${isActive ? "sidebar-link-active" : "sidebar-link-inactive"}`}
            >
              <link.icon className="h-4 w-4" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}

        {/* Notifications link */}
        <NavLink
          to={isAdmin ? "/admin/notifications" : "/employee/notifications"}
          className={`sidebar-link ${location.pathname.includes("notifications") ? "sidebar-link-active" : "sidebar-link-inactive"
            }`}
        >
          <Bell className="h-4 w-4" />
          <span>Notifications</span>
          {unread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-xs font-medium text-sidebar-primary-foreground">
              {unread}
            </span>
          )}
        </NavLink>
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium truncate">{profile?.full_name}</p>
          <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.department}</p>
        </div>
        <button
          onClick={signOut}
          className="sidebar-link sidebar-link-inactive w-full text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
