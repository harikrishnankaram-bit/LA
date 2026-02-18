import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

const leaveTypes = ["Casual Leave", "Sick Leave", "Earned Leave", "Personal Leave"];

const ApplyLeavePage = () => {
  const { user } = useAuth();
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
      toast.error("Please fill all fields");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("End date must be after start date");
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

      // Create notification for admin - find admin user_id
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("role", "admin")
        .single();

      if (adminProfile) {
        await supabase.from("notifications").insert({
          user_id: adminProfile.user_id,
          message: `New leave request from employee (${leaveType}: ${startDate} to ${endDate})`,
        });
      }

      toast.success("Leave applied successfully!");
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to apply leave");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const cls = status === "APPROVED" ? "bg-green-100 text-green-700" : status === "REJECTED" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700";
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>{status.toLowerCase()}</span>;
  };

  return (
    <div>
      <h1 className="page-header mb-6">Apply Leave</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              New Leave Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Leave Type</Label>
                <Select value={leaveType} onValueChange={setLeaveType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for leave..." maxLength={500} />
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <><Send className="mr-2 h-4 w-4" />Submit Request</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Leave Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {myLeaves.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No leave requests yet</p>
            ) : (
              <div className="space-y-3">
                {myLeaves.map((leave: any) => (
                  <div key={leave.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{leave.leave_type}</span>
                      {statusBadge(leave.status)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {format(new Date(leave.start_date), "dd MMM")} — {format(new Date(leave.end_date), "dd MMM yyyy")}
                    </p>
                    {leave.admin_comment && (
                      <p className="mt-1 text-xs text-muted-foreground italic">Admin: {leave.admin_comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ApplyLeavePage;
