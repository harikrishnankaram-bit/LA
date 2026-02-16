import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

const LeaveApprovalPage = () => {
  const [comment, setComment] = useState<Record<string, string>>({});

  const { data: pendingLeaves = [], refetch } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leaves")
        .select("*, profiles!inner(full_name, department)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAction = async (leaveId: string, userId: string, action: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("leaves")
        .update({ status: action, admin_comment: comment[leaveId] || null })
        .eq("id", leaveId);
      if (error) throw error;

      // If approved, mark attendance as on_leave for those dates
      if (action === "approved") {
        const leave = pendingLeaves.find((l: any) => l.id === leaveId);
        if (leave) {
          const start = new Date(leave.from_date);
          const end = new Date(leave.to_date);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = format(d, "yyyy-MM-dd");
            await supabase.from("attendance").upsert({
              user_id: userId,
              date: dateStr,
              status: "on_leave",
              worked_hours: 0,
            }, { onConflict: "user_id,date" });
          }
        }
      }

      // Notify employee
      await supabase.from("notifications").insert({
        user_id: userId,
        message: `Your leave has been ${action === "approved" ? "Approved" : "Rejected"}${comment[leaveId] ? `: ${comment[leaveId]}` : ""}`,
      });

      toast.success(`Leave ${action}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to update leave");
    }
  };

  return (
    <div>
      <h1 className="page-header mb-6">Leave Approval</h1>

      {pendingLeaves.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-0 text-center py-8">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No pending leave requests</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingLeaves.map((leave: any) => (
            <Card key={leave.id}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-display font-semibold">{leave.profiles?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{leave.profiles?.department}</p>
                    <div className="mt-2 text-sm">
                      <span className="font-medium">{leave.leave_type}</span>
                      <span className="text-muted-foreground ml-2">
                        {format(new Date(leave.from_date), "dd MMM")} — {format(new Date(leave.to_date), "dd MMM yyyy")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{leave.reason}</p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-48">
                    <Textarea
                      placeholder="Comment (optional)"
                      value={comment[leave.id] || ""}
                      onChange={(e) => setComment({ ...comment, [leave.id]: e.target.value })}
                      className="text-sm h-16"
                      maxLength={200}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAction(leave.id, leave.user_id, "approved")} className="flex-1">
                        <CheckCircle className="mr-1 h-3.5 w-3.5" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleAction(leave.id, leave.user_id, "rejected")} className="flex-1">
                        <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeaveApprovalPage;
