import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

const LeaveApprovalPage = () => {
  const [comment, setComment] = useState<Record<string, string>>({});

  const { data: pendingLeaves = [], refetch } = useQuery({
    queryKey: ["pending-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaves")
        .select("*, profiles(full_name, department)")
        .eq("status", "PENDING")
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
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const handleAction = async (leaveId: string, userId: string, action: "APPROVED" | "REJECTED") => {
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

      await supabase.from("notifications").insert({
        user_id: userId,
        message: `Your leave has been ${action === "APPROVED" ? "Approved" : "Rejected"}`,
      });

      toast.success(`Leave ${action}`);
      refetch();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <h1 className="page-header mb-6">Pending Requests</h1>
        {pendingLeaves.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No pending requests</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {pendingLeaves.map((leave: any) => (
              <Card key={leave.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-bold">{leave.profiles?.full_name || "Unknown Employee"}</p>
                      <p className="text-sm text-muted-foreground">{leave.leave_type}: {format(new Date(leave.start_date), "dd MMM")} - {format(new Date(leave.end_date), "dd MMM")}</p>
                      <p className="text-sm italic">"{leave.reason}"</p>
                    </div>
                    <div className="flex flex-col gap-2 min-w-48">
                      <Textarea placeholder="Comment..." value={comment[leave.id] || ""} onChange={(e) => setComment({ ...comment, [leave.id]: e.target.value })} className="h-16 text-sm" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAction(leave.id, leave.user_id, "APPROVED")} className="flex-1">Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction(leave.id, leave.user_id, "REJECTED")} className="flex-1">Reject</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold font-display mb-4">Resolved History</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {resolvedLeaves.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">No history found</p>
              ) : (
                resolvedLeaves.map((leave: any) => (
                  <div key={leave.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{leave.profiles?.full_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{leave.leave_type} • {format(new Date(leave.start_date), "dd MMM")} - {format(new Date(leave.end_date), "dd MMM")}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${leave.status === "APPROVED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {leave.status}
                    </span>
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
