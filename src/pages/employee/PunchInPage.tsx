import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Building2, Home, LogOut, MapPin, Monitor, Coffee, Zap, Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import AttendanceCalendar from "@/components/AttendanceCalendar";
import { motion, AnimatePresence } from "framer-motion";

const PunchInPage = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [hasApprovedLeave, setHasApprovedLeave] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: latest } = await supabase
      .from("attendance_daily")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const active = latest?.[0];
    const localToday = format(new Date(), "yyyy-MM-dd");

    if (active && !active.logout_time) {
      setTodayAttendance(active);
    } else if (active && active.date === localToday) {
      setTodayAttendance(active);
    } else {
      setTodayAttendance(null);
    }

    const { data: leaves } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "APPROVED")
      .lte("start_date", today)
      .gte("end_date", today);
    setHasApprovedLeave((leaves || []).length > 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user, today]);

  const handleLogin = async (mode: "WFO" | "WFH") => {
    if (!user) return;
    if (hasApprovedLeave) {
      toast.error("Cannot punch in during approved leave.");
      return;
    }
    setPunching(true);
    try {
      // @ts-ignore
      const { error } = await supabase.rpc("mark_login", { mode_input: mode });
      if (error) throw error;
      toast.success(`Success! Session started via ${mode}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to start session");
    } finally {
      setPunching(false);
    }
  };

  const handleLogout = async () => {
    if (!user) return;
    setPunching(true);
    try {
      // @ts-ignore
      const { error } = await supabase.rpc("mark_logout");
      if (error) throw error;
      toast.success("Great job! Session completed.");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to end session");
    } finally {
      setPunching(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          <span className="text-emerald-500">PUNCH</span> PORTAL
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Daily Attendance Entry</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl mx-auto"
      >
        <Card className="glass-card border-border overflow-hidden shadow-2xl">
          <CardHeader className="text-center bg-secondary/30 py-10 border-b border-border">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-500 shadow-inner border border-emerald-500/20"
            >
              <Clock size={40} />
            </motion.div>
            <CardTitle className="text-2xl font-black font-display text-foreground tracking-tight uppercase italic">
              {format(new Date(), "EEEE, dd MMMM")}
            </CardTitle>
            <p className="text-muted-foreground font-black text-[10px] uppercase tracking-widest mt-2 flex items-center justify-center gap-2">
              <span className="h-1 w-1 bg-emerald-500 rounded-full animate-ping" />
              Attendance Tracking Active
            </p>
          </CardHeader>

          <CardContent className="p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="h-12 w-12 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full"
                  />
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] animate-pulse">Authenticating User</p>
                </div>
              ) : hasApprovedLeave ? (
                <div className="rounded-3xl bg-blue-500/10 border border-blue-500/20 p-8 text-center text-blue-500">
                  <Coffee size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-xl font-black uppercase tracking-tight">On Leave</p>
                  <p className="mt-2 text-sm font-medium opacity-70 italic font-display">You have a registered leave for today.</p>
                </div>
              ) : todayAttendance ? (
                <div className="space-y-8">
                  {/* Digital Status Badge */}
                  <div className={`relative overflow-hidden rounded-3xl border p-6 text-center transition-all ${todayAttendance.status === "PRESENT"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-lg"
                    : "bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-lg"
                    }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Zap size={60} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] mb-1 opacity-50">Operational Status</p>
                    <p className="text-4xl font-black italic font-display tracking-tighter uppercase">{todayAttendance.status}</p>
                    {todayAttendance.logout_time && (
                      <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-2">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">SESSION RECORDED:</span>
                        <span className="text-xl font-black font-mono text-foreground">
                          {((new Date(todayAttendance.logout_time).getTime() - new Date(todayAttendance.login_time).getTime()) / (1000 * 60 * 60)).toFixed(2)}H
                        </span>
                      </div>
                    )}
                  </div>

                  {/* High Tech Grid */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="rounded-3xl border border-border bg-secondary/20 p-6 shadow-sm hover:bg-secondary/30 transition-colors">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 font-display">Punch Entry</p>
                      <p className="font-mono text-2xl font-black text-foreground">
                        {format(new Date(todayAttendance.login_time), "HH:mm")}
                      </p>
                      <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                        {todayAttendance.mode === "WFO" ? <Building2 size={10} /> : <Monitor size={10} />}
                        {todayAttendance.mode}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-border bg-secondary/10 p-6 border-dashed">
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 font-display">Punch Exit</p>
                      {todayAttendance.logout_time ? (
                        <p className="font-mono text-2xl font-black text-foreground">
                          {format(new Date(todayAttendance.logout_time), "HH:mm")}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="font-mono text-2xl font-black text-muted-foreground opacity-30">--:--</p>
                          <div className="flex gap-1">
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse delay-75" />
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse delay-150" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!todayAttendance.logout_time && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleLogout}
                        disabled={punching}
                        className="w-full h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-black text-lg shadow-xl shadow-orange-500/20 transition-all border-none uppercase tracking-widest"
                      >
                        {punching ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <LogOut className="h-6 w-6" />
                            Punch Out
                          </div>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <button
                        onClick={() => handleLogin("WFO")}
                        disabled={punching}
                        className="w-full group rounded-3xl p-8 flex flex-col items-center gap-4 bg-secondary/10 border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all duration-500"
                      >
                        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                          <Building2 size={32} />
                        </div>
                        <div className="text-center">
                          <p className="font-black text-foreground text-lg tracking-tight uppercase">Office</p>
                          <p className="text-[10px] text-muted-foreground font-black tracking-widest uppercase mt-1">WFO Environment</p>
                        </div>
                      </button>
                    </motion.div>

                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <button
                        onClick={() => handleLogin("WFH")}
                        disabled={punching}
                        className="w-full group rounded-3xl p-8 flex flex-col items-center gap-4 bg-secondary/10 border border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-all duration-500"
                      >
                        <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                          <Monitor size={32} />
                        </div>
                        <div className="text-center">
                          <p className="font-black text-foreground text-lg tracking-tight uppercase">Remote</p>
                          <p className="text-[10px] text-muted-foreground font-black tracking-widest uppercase mt-1">Work From Home</p>
                        </div>
                      </button>
                    </motion.div>
                  </div>
                  <p className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4 leading-relaxed opacity-60">
                    By punching in, you confirm your attendance for today.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-4xl mx-auto rounded-[2rem] overflow-hidden glass-card border border-border shadow-2xl bg-card/30 backdrop-blur-xl"
      >
        <div className="p-6 border-b border-border bg-secondary/30 flex items-center gap-3">
          <Activity className="h-4 w-4 text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-foreground">Attendance History</p>
        </div>
        <div className="p-6 sm:p-10">
          <AttendanceCalendar />
        </div>
      </motion.div>
    </div>
  );
};

export default PunchInPage;
