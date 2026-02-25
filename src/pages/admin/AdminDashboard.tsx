import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, Briefcase, UserCheck, Zap, Activity, ShieldCheck, Bell } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";
import { format, getDay } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const isSunday = getDay(new Date()) === 0;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-analytics", user?.id],
    refetchInterval: 60000, // Sync every minute instead of every 5s to save quota
    refetchOnWindowFocus: true, // Refresh immediately when admin switches back to tab
    staleTime: 30000,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const [employees, todayAtt, leaves, notifs] = await Promise.all([
        supabase.from("profiles").select("*").eq("role", "employee"),
        supabase.from("attendance_daily").select("*").eq("date", today),
        supabase.from("leaves").select("*, profiles(full_name, department)").eq("status", "APPROVED"),
        supabase.from("notifications").select("*").eq("user_id", user?.id).order("created_at", { ascending: false }).limit(5),
      ]);

      const empData = employees.data || [];
      const attData = todayAtt.data || [];
      const leaveData = leaves.data || [];

      const basicStats = {
        totalEmployees: empData.length,
        presentToday: attData.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length,
        lateToday: attData.filter((a: any) => a.status === "LATE").length,
        onLeaveToday: leaveData.filter((l: any) => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          const t = new Date(today);
          return t >= start && t <= end;
        }).length,
        pendingLeaves: 0,
      };

      const { count: pendingCount } = await supabase
        .from("leaves")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING");

      basicStats.pendingLeaves = pendingCount || 0;

      const leaveTypeMap: Record<string, number> = {};
      leaveData.forEach(l => {
        leaveTypeMap[l.leave_type] = (leaveTypeMap[l.leave_type] || 0) + 1;
      });
      const leaveTypeDist = Object.entries(leaveTypeMap).map(([name, value]) => ({ name, value }));

      const compAttMap: Record<string, number> = {};
      attData.forEach((a: any) => {
        if (a.status === "PRESENT" || a.status === "LATE") {
          const emp = empData.find((e: any) => e.user_id === a.user_id);
          const comp = emp?.company || "Unassigned";
          compAttMap[comp] = (compAttMap[comp] || 0) + 1;
        }
      });
      const compDist = Object.entries(compAttMap).map(([name, value]) => ({ name, value }));

      const currentlyOnLeave = leaveData.filter((l: any) => {
        const start = l.start_date;
        const end = l.end_date;
        return today >= start && today <= end;
      }).map((l: any) => ({
        name: l.profiles?.full_name,
        dept: l.profiles?.department,
        type: l.leave_type,
        until: l.end_date
      }));

      return {
        basicStats,
        leaveTypeDist,
        compDist,
        currentlyOnLeave,
        notifications: notifs.data || []
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-16 w-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        >
          <Activity className="text-white h-8 w-8" />
        </motion.div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-500 animate-pulse">Loading Data...</p>
      </div>
    );
  }

  const cards = [
    { label: "Total Employees", value: stats?.basicStats.totalEmployees || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Present Today", value: stats?.basicStats.presentToday || 0, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "On Leave", value: stats?.basicStats.onLeaveToday || 0, icon: Briefcase, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Pending Leaves", value: stats?.basicStats.pendingLeaves || 0, icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-10 pb-20"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
            Admin <span className="text-emerald-500">Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Overview</p>
        </div>
        <div className="flex items-center gap-4">
          {isSunday && (
            <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl backdrop-blur-sm animate-pulse">
              <Zap className="text-blue-500 h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">WEEKEND</span>
            </div>
          )}
          <div className="flex items-center gap-3 bg-secondary/50 border border-border px-4 py-2 rounded-2xl backdrop-blur-sm">
            <ShieldCheck className="text-emerald-500 h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">Admin Portal</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <motion.div key={c.label} variants={itemVariants}>
            <Card className="hover-3d border-border bg-card/50 backdrop-blur-sm group overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <c.icon size={60} className="text-foreground" />
              </div>
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${c.bg} shadow-inner`}>
                    <c.icon className={`h-7 w-7 ${c.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{c.label}</p>
                    <p className="text-4xl font-black font-display text-foreground mt-1 leading-none">{c.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-sm hover-3d overflow-hidden">
            <CardHeader className="bg-secondary/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
                <Zap className="h-4 w-4 text-emerald-500" />
                Leave Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] p-6">
              {stats?.leaveTypeDist.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.leaveTypeDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={100}
                      outerRadius={130}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {stats.leaveTypeDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card/80 backdrop-blur-2xl border border-border/50 p-4 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col gap-1 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: payload[0].payload?.fill || payload[0].color || payload[0].fill || "#10b981" }} />
                                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{payload[0].name}</p>
                              </div>
                              <p className="text-3xl font-black italic tracking-tighter text-foreground pl-4">
                                {payload[0].value} <span className="text-[10px] tracking-widest uppercase not-italic text-muted-foreground/30 ml-1">Leaves</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'transparent' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground italic">
                  <Activity size={40} className="opacity-20" />
                  <p className="text-xs font-black uppercase">No Data Available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-sm hover-3d overflow-hidden">
            <CardHeader className="bg-secondary/30 border-b border-border py-4">
              <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
                <Users className="h-4 w-4 text-emerald-500" />
                Company Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] p-6">
              {stats?.compDist?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.compDist || []}>
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'currentColor', fontWeight: 'bold' }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: 'currentColor', fontWeight: 'bold' }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-card/80 backdrop-blur-2xl border border-border/50 p-4 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col gap-1 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{payload[0].payload.name}</p>
                              </div>
                              <p className="text-3xl font-black italic tracking-tighter text-foreground pl-4">
                                {payload[0].value} <span className="text-[10px] tracking-widest uppercase not-italic text-muted-foreground/30 ml-1">Staff</span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    />
                    <Bar dataKey="value" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground italic">
                  <Activity size={40} className="opacity-20" />
                  <p className="text-xs font-black uppercase">No Data Available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-sm overflow-hidden h-full">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-700 py-4 px-8 border-none flex flex-row items-center justify-between text-white">
              <CardTitle className="text-xs font-black uppercase tracking-[0.4em]">
                Currently on Leave
              </CardTitle>
              <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black">LIVE STREAM</div>
            </CardHeader>
            <CardContent className="p-0 bg-secondary/10">
              {stats?.currentlyOnLeave.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <ShieldCheck size={48} className="text-emerald-500" />
                  <p className="text-xs font-black uppercase tracking-widest leading-relaxed text-foreground">No employees on leave today.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats?.currentlyOnLeave.map((emp, i) => (
                    <motion.div
                      whileHover={{ backgroundColor: 'var(--secondary)' }}
                      key={i}
                      className="flex items-center justify-between p-6 px-8 transition-colors"
                    >
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <div className="absolute inset-0 bg-emerald-500/10 blur-lg rounded-full" />
                          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-black text-2xl text-white shadow-lg">
                            {emp.name?.[0]}
                          </div>
                        </div>
                        <div>
                          <p className="font-black text-foreground tracking-tight uppercase">{emp.name}</p>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">{emp.dept || "Unassigned Department"}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-4 py-1.5 text-[10px] font-black text-emerald-600 border border-emerald-500/20 uppercase tracking-widest">
                          {emp.type}
                        </span>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">Until: {format(new Date(emp.until), "dd MMM")}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-sm overflow-hidden h-full">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 py-4 px-8 border-none flex flex-row items-center justify-between text-white">
              <CardTitle className="text-xs font-black uppercase tracking-[0.4em]">
                Notifications
              </CardTitle>
              <Bell size={18} className="text-white/50" />
            </CardHeader>
            <CardContent className="p-0 bg-secondary/10">
              {stats?.notifications.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <Bell size={48} className="text-blue-500" />
                  <p className="text-xs font-black uppercase tracking-widest leading-relaxed text-foreground">No active alerts found.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats?.notifications.map((notif: any) => (
                    <div key={notif.id} className="p-6 px-8 flex items-start gap-4 transition-colors hover:bg-secondary/40">
                      <div className={`mt-1 h-2 w-2 rounded-full ${notif.read_status ? 'bg-muted-foreground/30' : 'bg-blue-500 animate-pulse'}`} />
                      <div>
                        <p className={`text-sm tracking-tight ${notif.read_status ? 'text-muted-foreground' : 'text-foreground font-bold'}`}>
                          {notif.message}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase mt-2">
                          {format(new Date(notif.created_at), "dd MMM, HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
