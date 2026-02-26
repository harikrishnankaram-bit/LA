import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminClient } from "@/integrations/supabase/adminClient";
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
      toast.error("Please provide all required fields.");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must follow start date.");
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
        const adminClient = getAdminClient();

        // Find all administrative UUIDs directly from all profiles with admin role
        const { data: admins, error: adminQueryErr } = await adminClient
          .from("profiles")
          .select("user_id, role")
          .in("role", ["admin", "Admin", "ADMIN"]);

        if (adminQueryErr) throw adminQueryErr;

        const adminIds = new Set<string>();
        admins?.forEach((p: any) => adminIds.add(p.user_id));

        // Fallback: search auth users if no profiles found
        if (adminIds.size === 0) {
          const { data: authUsers } = await adminClient.auth.admin.listUsers();
          authUsers?.users?.forEach((u: any) => {
            if (
              u.user_metadata?.role?.toLowerCase() === 'admin' ||
              u.email?.toLowerCase().includes('admin') ||
              u.email?.toLowerCase().includes('harikrishnan')
            ) {
              adminIds.add(u.id);
            }
          });
        }

        if (adminIds.size > 0) {
          const notificationEntries = Array.from(adminIds).map(id => ({
            user_id: id,
            message: `New leave request from ${profile?.full_name || profile?.username || 'an employee'} for ${leaveType}`,
            read_status: false
          }));

          const { error: insertErr } = await adminClient.from("notifications").insert(notificationEntries);
          if (insertErr) throw insertErr;
        }
      } catch (notifyErr) {
        console.error("CRITICAL: Notification relay system failure:", notifyErr);
      }

      toast.success("Leave Request Submitted Successfully!");
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

  const handleCancelRequest = async (leaveId: string) => {
    try {
      const adminClient = getAdminClient();
      const { error } = await adminClient
        .from("leaves")
        .update({ status: "CANCEL_REQUESTED" })
        .eq("id", leaveId)
        .eq("user_id", user!.id);
      if (error) throw error;

      toast.success("Cancellation request sent to admin");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Request failed");
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
      case "CANCEL_REQUESTED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-500 text-[10px] font-black uppercase border border-orange-500/30">
          <AlertCircle size={10} /> Cancellation Requested
        </div>;
      case "CANCELLED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/20 text-gray-500 text-[10px] font-black uppercase border border-gray-500/30">
          <XCircle size={10} /> Cancelled
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
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          <span className="text-blue-500">APPLY</span> LEAVE
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] ml-1">Leave Authorization System</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3"
        >
          <Card className="glass-card border-border overflow-hidden shadow-2xl h-full bg-card/50 backdrop-blur-lg">
            <CardHeader className="bg-secondary/30 border-b border-border p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black text-foreground flex items-center gap-3 italic uppercase">
                  <CalendarDays size={28} className="text-blue-500" />
                  Submit Request
                </CardTitle>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-2">Submit leave request parameters</p>
              </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Leave Type</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger className="h-14 bg-background border-border rounded-2xl text-foreground font-bold focus:ring-blue-500/50">
                      <SelectValue placeholder="Select classification" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      {leaveTypes.map((t) => (
                        <SelectItem key={t} value={t} className="font-bold">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-14 bg-background border-border rounded-2xl text-foreground font-bold focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-14 bg-background border-border rounded-2xl text-foreground font-bold focus:ring-blue-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reason</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter detailed reason for leave..."
                    className="min-h-[150px] bg-background border-border rounded-2xl text-foreground font-bold placeholder:text-muted-foreground/30 focus:ring-blue-500/50 resize-none p-4"
                    maxLength={500}
                  />
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Button type="submit" disabled={submitting} className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-lg shadow-xl shadow-blue-500/20 transition-all uppercase tracking-widest border-none">
                    {submitting ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <div className="flex items-center justify-center gap-3">
                        <Send size={20} />
                        Submit Request
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
          <Card className="glass-card border-border shadow-2xl h-full flex flex-col bg-card/30 backdrop-blur-lg">
            <CardHeader className="bg-secondary/30 border-b border-border py-6">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2 text-foreground">
                <Activity size={16} className="text-blue-500" />
                Leave History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[700px]">
              <AnimatePresence>
                {myLeaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 opacity-30 gap-4">
                    <AlertCircle size={48} className="text-muted-foreground" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">History Empty</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {myLeaves.map((leave: any) => (
                      <motion.div
                        key={leave.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-6 transition-colors hover:bg-secondary/20"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-black text-foreground tracking-tight leading-none uppercase">{leave.leave_type}</p>
                          <div className="flex items-center gap-2">
                            {statusBadge(leave.status)}
                            {(leave.status === "PENDING" || leave.status === "APPROVED") && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelRequest(leave.id)}
                                className="h-6 px-2 text-[9px] border-red-500/30 text-red-500 hover:bg-red-500/10 uppercase tracking-widest"
                              >
                                Cancel Leave
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="px-3 py-1 rounded-lg bg-background border border-border font-mono text-[11px] font-bold text-muted-foreground">
                            {format(new Date(leave.start_date), "dd MMM")}
                          </div>
                          <div className="h-px w-4 bg-border" />
                          <div className="px-3 py-1 rounded-lg bg-background border border-border font-mono text-[11px] font-bold text-muted-foreground">
                            {format(new Date(leave.end_date), "dd MMM, yyyy")}
                          </div>
                        </div>
                        {leave.admin_comment && (
                          <div className="mt-4 p-4 rounded-xl bg-secondary/50 border-l-4 border-blue-500">
                            <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 mb-1">Admin Note:</p>
                            <p className="text-xs text-foreground font-medium italic">"{leave.admin_comment}"</p>
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
