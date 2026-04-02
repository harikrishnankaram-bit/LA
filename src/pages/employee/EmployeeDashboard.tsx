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
  const [hasApprovedLeave, setHasApprovedLeave] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    const localToday = format(new Date(), "yyyy-MM-dd");
    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

    // Check for approved leave today
    const { data: leaves } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["APPROVED", "CANCEL_REQUESTED"])
      .lte("from_date", localToday)
      .gte("to_date", localToday);

    setHasApprovedLeave((leaves || []).length > 0);

    const { data: latestRecords } = await supabase
      .from("attendance_daily")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latest = latestRecords?.[0];

    // Only show active shift if it's from today. 
    // Records from previous days (even if logout_time is null) should be ignored
    // as they will be auto-closed by the database on the next punch action.
    if (latest && latest.date === localToday) {
      setTodayAttendance(latest);
    } else {
      setTodayAttendance(null);
    }

    const { data: weekData } = await supabase
      .from("attendance_daily")
      .select("date, status, mode")
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end);

    if (weekData) {
      const stats = { Present: 0, Late: 0, Leave: 0, WFH: 0, WFO: 0 };
      
      // Calculate how many days have passed in the current week range
      // or just assume 5 working days? Let's keep it simple and just count missing days up to today.
      const attendedDates = new Set((weekData || []).map(d => d.date));
      const todayString = format(new Date(), "yyyy-MM-dd");
      
      weekData.forEach((record: any) => {
        if (record.status === "PRESENT") stats.Present++;
        else if (record.status === "LATE") stats.Late++;
        else if (record.status === "ABSENT" || record.status === "LEAVE") stats.Leave++;
        
        if (record.mode === "WFH") stats.WFH++;
        else if (record.mode === "WFO") stats.WFO++;
      });

      // Add missing days as Leave (from start of week to today)
      let currentDate = new Date(start);
      const now = new Date();
      const todayCutoff = new Date();
      todayCutoff.setHours(11, 30, 0, 0);

      while (currentDate <= now) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const isCurrentIterationToday = dateStr === todayString;
        
        if (!attendedDates.has(dateStr)) {
          if (!isCurrentIterationToday || now > todayCutoff) {
            stats.Leave++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setWeeklyData([
        { name: "Present", value: stats.Present, color: "#10b981" },
        { name: "Late", value: stats.Late, color: "#f59e0b" },
        { name: "Leave", value: stats.Leave, color: "#3b82f6" },
        { name: "WFH", value: stats.WFH, color: "#8b5cf6" },
        { name: "WFO", value: stats.WFO, color: "#6366f1" },
      ].filter(d => d.value > 0));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleLogin = async (mode: "WFO" | "WFH") => {
    try {
      if (hasApprovedLeave) {
        toast.error("Cannot punch in during approved leave.");
        return;
      }
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
          <h1 className="page-header text-4xl flex items-center gap-2 text-foreground italic font-black uppercase tracking-tighter">
            Welcome <span className="text-emerald-500">Back</span> <Sparkles className="h-6 w-6 text-emerald-500 animate-pulse" />
          </h1>
          <p className="text-muted-foreground mt-1 text-[10px] font-black uppercase tracking-[0.4em] ml-1">Dashboard Overview</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="rounded-xl px-6 h-11 border-emerald-500/30 bg-background/50 backdrop-blur-md text-emerald-600 font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all"
        >
          Refresh Data
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-sm bg-card/50 backdrop-blur-lg">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <CalendarDays className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Calendar Slot</p>
                <h3 className="text-xl font-black font-display text-foreground italic uppercase tracking-tighter">{format(new Date(), "dd MMM, EEEE")}</h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={`glass-card border-border shadow-sm transition-all duration-300 ${hasApprovedLeave ? 'bg-blue-500/10 border-blue-500/20' : todayAttendance ? 'bg-emerald-500/5' : 'bg-card/30'}`}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${hasApprovedLeave ? 'bg-blue-500/20 text-blue-500' : todayAttendance ? 'bg-emerald-500/20 text-emerald-500' : 'bg-secondary/50 text-muted-foreground'}`}>
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Live Status</p>
                <h3 className="text-xl font-black font-display truncate text-foreground italic uppercase tracking-tighter">
                  {hasApprovedLeave ? "ON LEAVE" : todayAttendance ? todayAttendance.status : (() => {
                    const now = new Date();
                    const cutoff = new Date();
                    cutoff.setHours(11, 30, 0, 0);
                    return now > cutoff ? "LEAVE" : "AWAITING PUNCH";
                  })()}
                </h3>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="overflow-hidden border-none shadow-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Clock size={80} strokeWidth={1} />
            </div>
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-black/10">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80">Quick Punch</span>
                {todayAttendance?.login_time && <span className="text-[10px] font-mono bg-white/20 px-3 py-1 rounded-full font-bold">STARTED: {format(new Date(todayAttendance.login_time), "HH:mm")}</span>}
              </div>
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <div className="h-12 w-full flex items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  ) : hasApprovedLeave ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-4 px-6 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm"
                    >
                      <p className="text-xl font-black italic tracking-tighter uppercase shrink-0">On Leave</p>
                      <p className="text-[10px] opacity-80 font-black uppercase tracking-widest mt-1">Approved Leave Active for Today</p>
                    </motion.div>
                  ) : !todayAttendance ? (
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button onClick={() => handleLogin("WFO")} className="flex-1 h-24 bg-white text-emerald-700 hover:bg-emerald-50 font-black rounded-2xl shadow-xl uppercase tracking-widest text-lg" size="lg">
                        <MapPin className="mr-3 h-6 w-6" /> Office
                      </Button>
                      <Button onClick={() => handleLogin("WFH")} variant="outline" className="flex-1 h-24 bg-white/10 border-white/20 hover:bg-white/20 text-white font-black rounded-2xl flex items-center justify-center uppercase tracking-widest text-lg" size="lg">
                        <Monitor className="mr-3 h-6 w-6" /> Remote
                      </Button>
                    </div>
                  ) : !todayAttendance.logout_time ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Button onClick={handleLogout} className="w-full h-16 font-black text-lg bg-orange-500 hover:bg-orange-600 text-white rounded-2xl shadow-xl uppercase tracking-widest border-none transition-all" size="lg">
                        <LogOut className="mr-3 h-6 w-6" /> Complete Shift
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-center py-4 px-6 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm"
                    >
                      <p className="text-xl font-black italic tracking-tighter uppercase shrink-0">Shift Complete</p>
                      <p className="text-[10px] opacity-80 font-black uppercase tracking-widest mt-1">Session Ended at {format(new Date(todayAttendance.logout_time), "HH:mm")}</p>
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
          <Card className="glass-card border-border shadow-sm bg-card/50 backdrop-blur-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-6 border-b border-border/50">
              <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase text-muted-foreground">Attendance Analytics</CardTitle>
              <Zap className="h-5 w-5 text-emerald-500" />
            </CardHeader>
            <CardContent className="pt-8">
              <div className="h-[280px] w-full flex items-center justify-center">
                {weeklyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={weeklyData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={10}
                        dataKey="value"
                        stroke="none"
                      >
                        {weeklyData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-card/80 backdrop-blur-2xl border border-border/50 p-4 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] flex flex-col gap-1 min-w-[140px]">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
                                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">{payload[0].name}</p>
                                </div>
                                <p className="text-3xl font-black italic tracking-tighter text-foreground pl-4">
                                  {payload[0].value} <span className="text-[10px] tracking-widest uppercase not-italic text-muted-foreground/30 ml-1">Days</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-4">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center space-y-4 opacity-50">
                    <Zap className="h-16 w-16 mx-auto text-muted-foreground/20" strokeWidth={1} />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Historical activity empty</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-border shadow-2xl bg-card/30 backdrop-blur-lg h-full relative overflow-hidden">
            <div className="absolute -bottom-20 -right-20 opacity-5">
              <Sparkles size={300} className="text-emerald-500" />
            </div>
            <CardHeader className="pb-6 border-b border-border/50">
              <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase text-muted-foreground">Efficiency Metrics (KPI)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pt-8 relative z-10">
              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground group-hover:text-emerald-500 transition-colors uppercase tracking-widest">TOTAL PRESENT</span>
                  <p className="text-5xl font-black font-display text-foreground italic tracking-tighter">{weeklyData.find(d => d.name === 'Present')?.value || 0}</p>
                </div>
                <div className="h-12 w-px bg-border/50" />
              </div>

              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground group-hover:text-amber-500 transition-colors uppercase tracking-widest">LATE DAYS</span>
                  <p className="text-5xl font-black font-display text-amber-500 italic tracking-tighter">{weeklyData.find(d => d.name === 'Late')?.value || 0}</p>
                </div>
                <div className="h-12 w-px bg-border/50" />
              </div>

              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground group-hover:text-blue-500 transition-colors uppercase tracking-widest">REMOTE DAYS</span>
                  <p className="text-5xl font-black font-display text-blue-500 italic tracking-tighter">{weeklyData.find(d => d.name === 'WFH')?.value || 0}</p>
                </div>
                <div className="h-12 w-px bg-border/50" />
              </div>

              <div className="flex justify-between items-end group">
                <div>
                  <span className="text-[10px] font-black text-muted-foreground group-hover:text-orange-500 transition-colors uppercase tracking-widest">LEAVE DAYS</span>
                  <p className="text-5xl font-black font-display text-orange-500 italic tracking-tighter">{weeklyData.find(d => d.name === 'Leave')?.value || 0}</p>
                </div>
              </div>

              <div className="pt-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-black text-muted-foreground tracking-widest uppercase">Productivity Index</p>
                  <p className="text-[10px] font-black text-emerald-500 uppercase">84% Optimal</p>
                </div>
                <div className="w-full bg-secondary h-3 rounded-full overflow-hidden border border-border/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '84%' }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default EmployeeDashboard;
