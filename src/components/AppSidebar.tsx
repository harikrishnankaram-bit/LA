import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  FileBarChart,
  LogOut,
  UserPlus,
  Users,
  CheckCircle,
  Bell,
  ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const employeeLinks = [
  { to: "/employee", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employee/punch", icon: Clock, label: "Punch Portal" },
  { to: "/employee/leave", icon: CalendarDays, label: "Apply Leave" },
  { to: "/employee/report", icon: FileBarChart, label: "My Stats" },
];

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/employees", icon: Users, label: "Workforce" },
  { to: "/admin/attendance", icon: Users, label: "Attendance" },
  { to: "/admin/leaves", icon: CheckCircle, label: "Approvals" },
  { to: "/admin/holidays", icon: CalendarDays, label: "Holidays" },
  { to: "/admin/reports", icon: FileBarChart, label: "Analytics" },
];

const AppSidebar = ({ onClose }: { onClose?: () => void }) => {
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

    const channel = supabase
      .channel('unread-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border shadow-xl">
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
          <img
            src={`/${profile?.company || "logo"}.png`}
            alt="Logo"
            className="relative h-10 w-auto object-contain"
            onError={(e) => {
              if (e.currentTarget.src.includes('logo.png')) {
                e.currentTarget.style.display = 'none';
              } else {
                e.currentTarget.src = "/logo.png";
              }
            }}
          />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="font-display text-lg font-black tracking-tighter text-foreground uppercase whitespace-nowrap">
            {profile?.company || "VAAZHAI"} <span className="text-emerald-500">TK</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50 leading-none mt-1">
            {profile?.role} INTERFACE
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Navigation</p>
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onClose}
              className={`group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-300 ${isActive
                ? "bg-emerald-500 text-white shadow-[0_10px_20px_rgba(16,185,129,0.2)]"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
            >
              <link.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
              <span className="flex-1">{link.label}</span>
              {isActive && (
                <motion.div layoutId="activeArrow">
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </motion.div>
              )}
            </NavLink>
          );
        })}

        <div className="my-6 h-px bg-sidebar-border mx-3" />
        <p className="px-3 mb-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Internal</p>

        <NavLink
          to={isAdmin ? "/admin/notifications" : "/employee/notifications"}
          onClick={onClose}
          className={`group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-300 ${location.pathname.includes("notifications")
            ? "bg-blue-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.2)]"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
        >
          <Bell className="h-5 w-5" />
          <span className="flex-1">Alerts</span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-lg bg-red-500 px-1.5 text-[10px] font-black text-white animate-pulse shadow-lg">
              {unread}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-2xl bg-sidebar-accent/50 p-4 border border-sidebar-border relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-5 transition-opacity group-hover:opacity-20">
            <LayoutDashboard size={40} className="text-foreground" />
          </div>
          <div className="relative z-10 flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-lg text-white">
              {profile?.full_name?.[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate leading-none mb-1 text-foreground">{profile?.full_name}</p>
              <p className="text-[10px] text-muted-foreground font-bold truncate uppercase tracking-wider">{profile?.department || "General"}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-red-500/10 py-2.5 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Terminate Session
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
