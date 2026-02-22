import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Send, Activity, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

const leaveTypes = ["Casual Leave", "Sick Leave", "Earned Leave", "Personal Leave"];

const ApplyLeavePage = () => {
  const { user, profile } = useAuth();
  const [leaveType, setLeaveType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: myLeaves = [], refetch } = useQuery({
    queryKey: ["my-leaves", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveType || !startDate || !endDate || !reason.trim()) {
      toast.error("Connectivity Issue: Please provide all required data packets.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("Logic Error: Temporal paradox detected. End date must follow start date.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("leaves").insert({
        user_id: user!.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: 'PENDING'
      });
      if (error) throw error;

      // 2. Relay Notifications to Administrators
      try {
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const adminClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            serviceRoleKey,
            { auth: { persistSession: false } }
          );

          // Find all administrative UUIDs via multiple channels for maximum reliability
          const [profileAdmins, authUsers] = await Promise.all([
            adminClient.from("profiles").select("user_id").eq("role", "admin"),
            adminClient.auth.admin.listUsers()
          ]);

          const adminIds = new Set<string>();

          // Channel 1: Profiles table
          profileAdmins.data?.forEach(p => adminIds.add(p.user_id));

          // Channel 2: Auth metadata (Fallback)
          authUsers.data?.users.forEach(u => {
            if (u.user_metadata?.role === 'admin' || u.email?.includes('admin@vaazhai')) {
              adminIds.add(u.id);
            }
          });

          if (adminIds.size > 0) {
            const notificationEntries = Array.from(adminIds).map(id => ({
              user_id: id,
              message: `PROTOCOL ALERT: New leave request from ${profile?.full_name || profile?.username || 'Authorized Personnel'} (${leaveType})`,
              read_status: false
            }));

            await adminClient.from("notifications").insert(notificationEntries);
          }
        }
      } catch (notifyErr) {
        console.warn("CRITICAL: Notification relay system failure:", notifyErr);
      }

      toast.success("Leave Request Uploaded Successfully!");
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase border border-emerald-500/30">
          <CheckCircle size={10} /> Authorized
        </div>;
      case "REJECTED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black uppercase border border-red-500/30">
          <XCircle size={10} /> Denied
        </div>;
      default:
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase border border-amber-500/30 animate-pulse">
          <Clock size={10} /> Pending
        </div>;
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-white">
          <span className="text-blue-500">LEAVE</span> PROTOCOL
        </h1>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-[0.2em] ml-1">Absence Authorization System</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <Card className="glass-card border-none overflow-hidden shadow-2xl h-full">
            <CardHeader className="bg-white/5 border-b border-white/5 p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                  <CalendarDays size={28} className="text-blue-500" />
                  INITIATE REQUEST
                </CardTitle>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Submit temporal absence parameters</p>
              </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">Leave Classification</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:ring-blue-500/50">
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10">
                      {leaveTypes.map((t) => (
                        <SelectItem key={t} value={t} className="text-white hover:bg-white/10">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">Commencement Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">Termination Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">Justification Protocol</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter detailed justification for absence..."
                    className="min-h-[150px] bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-slate-600 focus:ring-blue-500/50 resize-none p-4"
                    maxLength={500}
                  />
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button type="submit" disabled={submitting} className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-lg shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all">
                    {submitting ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <Send size={20} />
                        TRANSMIT REQUEST
                      </div>
                    )}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2"
        >
          <Card className="glass-card border-none shadow-2xl h-full flex flex-col">
            <CardHeader className="bg-white/5 border-b border-white/5 py-6">
              <CardTitle className="text-xs font-black uppercase tracking-[0.4em] flex items-center gap-2">
                <Activity size={16} className="text-blue-500" />
                Datalog: Transmission Archive
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[700px]">
              <AnimatePresence>
                {myLeaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 opacity-30 gap-4">
                    <AlertCircle size={48} />
                    <p className="text-xs font-black uppercase tracking-widest">Archive Empty</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {myLeaves.map((leave: any) => (
                      <motion.div
                        key={leave.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-6 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-black text-white tracking-tight leading-none uppercase">{leave.leave_type}</p>
                          {statusBadge(leave.status)}
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-slate-400">
                            {format(new Date(leave.start_date), "dd MMM")}
                          </div>
                          <div className="h-px w-4 bg-slate-700" />
                          <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-slate-400">
                            {format(new Date(leave.end_date), "dd MMM, yyyy")}
                          </div>
                        </div>
                        {leave.admin_comment && (
                          <div className="mt-4 p-3 rounded-xl bg-black/20 border-l-2 border-blue-500">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1">Controller Dispatch:</p>
                            <p className="text-xs text-slate-400 italic">"{leave.admin_comment}"</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ApplyLeavePage;
