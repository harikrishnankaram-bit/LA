import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CalendarDays, CheckCircle, LogOut, Sparkles, Zap, MapPin, Monitor } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const localToday = format(new Date(), "yyyy-MM-dd");
    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

    const { data: latestRecords } = await supabase
      .from("attendance_daily")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = latestRecords?.[0];

    if (latest && !latest.logout_time) {
      setTodayAttendance(latest);
    } else if (latest && latest.date === localToday) {
      setTodayAttendance(latest);
    } else {
      setTodayAttendance(null);
    }

    const { data: weekData } = await supabase
      .from("attendance_daily")
      .select("status, mode")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end);

    if (weekData) {
      const stats = { Present: 0, Late: 0, Absent: 0, WFH: 0, WFO: 0 };
      weekData.forEach((record: any) => {
        if (record.status === "PRESENT") stats.Present++;
        else if (record.status === "LATE") stats.Late++;
        else if (record.status === "ABSENT") stats.Absent++;
        if (record.mode === "WFH") stats.WFH++;
        else if (record.mode === "WFO") stats.WFO++;
      });

      setWeeklyData([
        { name: "Present", value: stats.Present, color: "#10b981" },
        { name: "Late", value: stats.Late, color: "#f59e0b" },
        { name: "Absent", value: stats.Absent, color: "#ef4444" },
        { name: "WFH", value: stats.WFH, color: "#3b82f6" },
        { name: "WFO", value: stats.WFO, color: "#8b5cf6" },
      ].filter(d => d.value > 0));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLogin = async (mode: "WFO" | "WFH") => {
    try {
      setLoading(true);
      // @ts-ignore
      const { error } = await supabase.rpc("mark_login", { mode_input: mode });
      if (error) throw error;
      toast.success(`Punched in successfully via ${mode}!`, {
        icon: <Zap className="h-4 w-4 text-yellow-500" />
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      // @ts-ignore
      const { error } = await supabase.rpc("mark_logout");
      if (error) throw error;
      toast.info("Shift completed. Great work today!", {
        icon: <Sparkles className="h-4 w-4 text-blue-500" />
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Logout failed");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header text-3xl flex items-center gap-2 text-foreground italic font-black uppercase tracking-tighter">
            Welcome Back <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Here's your productivity overview for today.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="rounded-full px-4 hover-3d border-emerald-500/50 text-emerald-600 hover:bg-emerald-500 hover:text-white"
        >
          Refresh Real-time Data
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card className="hover-3d border-border shadow-sm bg-gradient-to-br from-indigo-500/5 to-transparent">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Date</p>
                <h3 className="text-xl font-black font-display text-foreground">{format(new Date(), "dd MMM, EEEE")}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={`hover-3d border-border shadow-sm transition-colors ${todayAttendance ? 'bg-emerald-500/10' : 'bg-secondary/30'}`}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${todayAttendance ? 'bg-emerald-500/20 text-emerald-600' : 'bg-muted/20 text-muted-foreground'}`}>
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Live Status</p>
                <h3 className="text-xl font-black font-display truncate text-foreground">{todayAttendance ? (todayAttendance.status) : "Ready to Start"}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Clock size={80} strokeWidth={1} />
            </div>
            <CardContent className="p-0">
              <div className="px-6 py-3 border-b border-white/10 flex justify-between items-center bg-black/5">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Quick Punch Portal</span>
                {todayAttendance?.login_time && <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded-full">Started: {format(new Date(todayAttendance.login_time), "hh:mm a")}</span>}
              </div>
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-12 w-full flex items-center justify-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-white animate-bounce" />
                      <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 rounded-full bg-white animate-bounce [animation-delay:0.4s]" />
                    </div>
                  ) : !todayAttendance ? (
                    <div className="flex gap-4">
                      <Button onClick={() => handleLogin("WFO")} className="flex-1 h-14 bg-white text-emerald-700 hover:bg-emerald-50 font-black rounded-2xl shadow-lg" size="lg">
                        <MapPin className="mr-2 h-5 w-5" /> Office (WFO)
                      </Button>
                      <Button onClick={() => handleLogin("WFH")} variant="outline" className="flex-1 h-14 bg-white/10 border-white/20 hover:bg-white/20 text-white font-black rounded-2xl sm:block hidden" size="lg">
                        <Monitor className="mr-2 h-5 w-5" /> Remote (WFH)
                      </Button>
                    </div>
                  ) : !todayAttendance.logout_time ? (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Button onClick={handleLogout} variant="destructive" className="w-full h-14 font-black text-lg bg-orange-500 hover:bg-orange-600 rounded-2xl shadow-[0_8px_0_rgba(194,65,12,0.4)] transition-all" size="lg">
                        <LogOut className="mr-3 h-6 w-6" /> COMPLETE SHIFT
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-center py-2 px-4 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm"
                    >
                      <p className="text-xl font-black">🌟 YOU'RE ALL SET!</p>
                      <p className="text-xs opacity-80 font-medium">Logged out at {format(new Date(todayAttendance.logout_time), "hh:mm a")}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-border shadow-sm hover-3d h-full bg-card/50 backdrop-blur-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-black tracking-tight uppercase opacity-50 text-foreground">Impact Analytics</CardTitle>
              <Zap className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full flex items-center justify-center">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={weeklyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                      >
                        {weeklyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: '16px', border: 'none', background: 'var(--card)', color: 'var(--foreground)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center space-y-2 opacity-50">
                    <Zap className="h-10 w-10 mx-auto text-muted-foreground" strokeWidth={1} />
                    <p className="text-sm font-medium text-muted-foreground">No activity data for this cycle.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-border shadow-sm bg-gradient-to-tr from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 text-foreground h-full relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 opacity-5">
              <Sparkles size={200} className="text-primary" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-black tracking-tight uppercase opacity-50">Performance KPIs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-4 relative z-10">
              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-xs font-black text-muted-foreground group-hover:text-emerald-600 transition-colors uppercase tracking-widest">DAYS PRESENT</span>
                  <p className="text-4xl font-black font-display text-foreground">{weeklyData.find(d => d.name === 'Present')?.value || 0}</p>
                </div>
                <div className="h-12 w-px bg-border" />
              </div>

              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-xs font-black text-muted-foreground group-hover:text-amber-500 transition-colors uppercase tracking-widest">LATE ARRIVALS</span>
                  <p className="text-4xl font-black font-display text-amber-500">{weeklyData.find(d => d.name === 'Late')?.value || 0}</p>
                </div>
                <div className="h-12 w-px bg-border" />
              </div>

              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-xs font-black text-muted-foreground group-hover:text-blue-500 transition-colors uppercase tracking-widest">HYBRID MODE (WFH)</span>
                  <p className="text-4xl font-black font-display text-blue-500">{weeklyData.find(d => d.name === 'WFH')?.value || 0}</p>
                </div>
              </div>

              <div className="pt-4">
                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '65%' }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="bg-emerald-500 h-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                  />
                </div>
                <p className="text-[10px] font-black mt-2 text-muted-foreground tracking-tighter uppercase">MONTHLY PRODUCTIVITY INDEX: 84%</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EmployeeDashboard;
