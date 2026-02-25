import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { CheckCircle, XCircle, Clock, CalendarDays, User, History, Send, ShieldAlert, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LeaveApprovalPage = () => {
  const [comment, setComment] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: pendingLeaves = [], refetch: refetchPending } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("*, profiles(full_name, department)")
        .in("status", ["PENDING", "CANCEL_REQUESTED"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching leaves:", error);
        return [];
      }
      return data || [];
    },
  });

  const { data: resolvedLeaves = [] } = useQuery({
    queryKey: ["resolved-leaves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leaves")
        .select("*, profiles(full_name, department)")
        .neq("status", "PENDING")
        .neq("status", "CANCEL_REQUESTED")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const handleAction = async (leaveId: string, userId: string, action: "APPROVED" | "REJECTED" | "CANCELLED") => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({
          status: action,
          admin_comment: comment[leaveId] || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", leaveId);
      if (error) throw error;

      if (action === "APPROVED") {
        const leave = pendingLeaves.find((l: any) => l.id === leaveId);
        if (leave) {
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            await supabase.from("attendance_daily").upsert({
              user_id: userId,
              date: dateStr,
              mode: "LEAVE",
              status: "ABSENT",
            }, { onConflict: "user_id,date" });
          }
        }
      }

      if (action === "CANCELLED") {
        const leave = pendingLeaves.find((l: any) => l.id === leaveId);
        if (leave && leave.status === "APPROVED") {
          // Attempt to remove auto-absent marks if cancelled
          const start = new Date(leave.start_date);
          const end = new Date(leave.end_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            await supabase.from("attendance_daily").delete().match({ user_id: userId, date: dateStr, mode: "LEAVE" });
          }
        } else {
          // Admin directly cancelling from resolved list
          const start = new Date(leave?.start_date || new Date());
          const end = new Date(leave?.end_date || new Date());
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            await supabase.from("attendance_daily").delete().match({ user_id: userId, date: dateStr, mode: "LEAVE" });
          }
        }
      }

      // Notify employee
      try {
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          const { createClient } = await import('@supabase/supabase-js');
          const rootClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            serviceRoleKey,
            { auth: { persistSession: false } }
          );
          await rootClient.from("notifications").insert({
            user_id: userId,
            message: `Your leave request has been ${action}.`,
            read_status: false
          });
        } else {
          await supabase.from("notifications").insert({
            user_id: userId,
            message: `Your leave request has been ${action}.`,
            read_status: false
          });
        }
      } catch (notifyErr) {
        console.error("Failed to notify user:", notifyErr);
      }

      toast.success(`Leave ${action}`);
      await queryClient.invalidateQueries({ queryKey: ["pending-leaves"] });
      await queryClient.invalidateQueries({ queryKey: ["resolved-leaves"] });
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase border border-emerald-500/20">
          <CheckCircle size={12} /> Approved
        </div>;
      case "REJECTED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-[10px] font-black uppercase border border-red-500/20">
          <XCircle size={12} /> Rejected
        </div>;
      case "CANCEL_REQUESTED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase border border-orange-500/20">
          <ShieldAlert size={12} /> Cancel Requested
        </div>;
      case "CANCELLED":
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 text-gray-400 text-[10px] font-black uppercase border border-gray-500/20">
          <XCircle size={12} /> Cancelled
        </div>;
      default:
        return <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase border border-amber-500/20">
          <Clock size={12} /> Pending
        </div>;
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          Leave <span className="text-blue-500">Approvals</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Leave Management</p>
      </div>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="text-amber-500 h-5 w-5" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/70">Pending Requests</h2>
        </div>

        {pendingLeaves.length === 0 ? (
          <Card className="glass-card border-border bg-card/30 backdrop-blur-lg border-dashed">
            <CardContent className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
              <Sparkles size={48} className="text-blue-500" />
              <p className="text-xs font-black uppercase tracking-widest text-foreground">No pending requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            <AnimatePresence>
              {pendingLeaves.map((leave: any) => (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="glass-card border-border overflow-hidden shadow-xl bg-card/50 backdrop-blur-xl">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        <div className="p-8 flex-1 border-b lg:border-b-0 lg:border-r border-border/50">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner">
                              <User size={24} />
                            </div>
                            <div>
                              <h3 className="text-xl font-black text-foreground italic uppercase tracking-tighter leading-none mb-1">
                                {leave.profiles?.full_name || "Employee"}
                              </h3>
                              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-secondary/50 px-2 py-0.5 rounded-md inline-block">
                                {leave.profiles?.department || "Department"}
                              </p>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-6 mb-8">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Classification</p>
                              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                {leave.leave_type}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Date Range</p>
                              <p className="text-xs font-mono font-bold text-foreground">
                                {format(new Date(leave.start_date), "dd MMM, yyyy")} <span className="text-muted-foreground mx-1">→</span> {format(new Date(leave.end_date), "dd MMM, yyyy")}
                              </p>
                            </div>
                          </div>

                          <div className="bg-secondary/30 p-5 rounded-2xl border border-border/50 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Send size={40} className="-rotate-12" />
                            </div>
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Reason</p>
                            <p className="text-sm font-medium italic text-foreground leading-relaxed">"{leave.reason}"</p>
                          </div>
                        </div>

                        <div className="p-8 w-full lg:w-[350px] bg-secondary/10 flex flex-col justify-between gap-6">
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Admin Note</p>
                            <Textarea
                              placeholder="Add a note..."
                              value={comment[leave.id] || ""}
                              onChange={(e) => setComment({ ...comment, [leave.id]: e.target.value })}
                              className="h-28 bg-background border-border rounded-xl text-sm font-medium focus:ring-blue-500/50 resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {leave.status !== "CANCEL_REQUESTED" && (
                              <>
                                <Button
                                  onClick={() => handleAction(leave.id, leave.user_id, "APPROVED")}
                                  className="h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-500/10 uppercase text-[11px] tracking-widest border-none"
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleAction(leave.id, leave.user_id, "REJECTED")}
                                  className="h-12 border-red-500/30 text-red-600 font-black rounded-xl hover:bg-red-500 hover:text-white uppercase text-[11px] tracking-widest transition-all"
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            {leave.status === "CANCEL_REQUESTED" && (
                              <>
                                <Button
                                  onClick={() => handleAction(leave.id, leave.user_id, "CANCELLED")}
                                  className="h-12 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl shadow-lg shadow-orange-500/10 uppercase text-[11px] tracking-widest border-none"
                                >
                                  Approve Cancel
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleAction(leave.id, leave.user_id, "APPROVED")}
                                  className="h-12 border-emerald-500/30 text-emerald-600 font-black rounded-xl hover:bg-emerald-500 hover:text-white uppercase text-[11px] tracking-widest transition-all"
                                >
                                  Deny Cancel
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
          <History className="text-blue-500 h-5 w-5" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/70">Past Requests</h2>
        </div>
        <Card className="glass-card border-border shadow-2xl bg-card/30 backdrop-blur-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {resolvedLeaves.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-50">
                  <CalendarDays size={40} className="text-muted-foreground" />
                  <p className="text-xs font-black uppercase tracking-widest text-foreground">No past requests found</p>
                </div>
              ) : (
                resolvedLeaves.map((leave: any) => (
                  <div key={leave.id} className="p-6 flex items-center justify-between hover:bg-secondary/20 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground group-hover:border-blue-500/50 transition-colors">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="font-black text-sm text-foreground uppercase tracking-tight italic">{leave.profiles?.full_name || "Unknown"}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                          {leave.leave_type} <span className="mx-1 opacity-30">•</span> {format(new Date(leave.start_date), "dd MMM")} - {format(new Date(leave.end_date), "dd MMM")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {statusBadge(leave.status)}
                      {leave.status === "APPROVED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(leave.id, leave.user_id, "CANCELLED")}
                          className="h-7 px-3 text-[9px] border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white uppercase tracking-widest transition-all"
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default LeaveApprovalPage;
