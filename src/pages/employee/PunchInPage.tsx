import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const PunchInPage = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [hasApprovedLeave, setHasApprovedLeave] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // Check today's attendance
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();
      setTodayAttendance(att);

      // Check approved leave
      const { data: leaves } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .lte("from_date", today)
        .gte("to_date", today);
      setHasApprovedLeave((leaves || []).length > 0);
      setLoading(false);
    };
    fetchData();
  }, [user, today]);

  const handlePunchIn = async () => {
    if (!user) return;
    setPunching(true);
    try {
      const now = new Date();
      // Set punch_out to 6:00 PM IST today
      const punchOut = new Date();
      punchOut.setHours(18, 0, 0, 0);

      const workedMs = punchOut.getTime() - now.getTime();
      const workedHours = Math.max(0, workedMs / (1000 * 60 * 60));
      const roundedHours = Math.round(workedHours * 100) / 100;

      let status = "absent";
      if (roundedHours >= 8) status = "present";
      else if (roundedHours >= 4) status = "half_day";

      const { error } = await supabase.from("attendance").insert({
        user_id: user.id,
        date: today,
        punch_in: now.toISOString(),
        punch_out: punchOut.toISOString(),
        worked_hours: roundedHours,
        status,
      });

      if (error) throw error;

      setTodayAttendance({
        punch_in: now.toISOString(),
        punch_out: punchOut.toISOString(),
        worked_hours: roundedHours,
        status,
      });
      toast.success("Punched in successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to punch in");
    } finally {
      setPunching(false);
    }
  };

  const hasPunched = !!todayAttendance?.punch_in;

  return (
    <div>
      <h1 className="page-header mb-6">Punch In</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Today — {format(new Date(), "EEEE, dd MMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : hasApprovedLeave ? (
            <div className="rounded-lg border p-4 text-center badge-on-leave">
              <p className="font-medium">You are on approved leave today</p>
              <p className="text-sm mt-1">Punch-in is disabled</p>
            </div>
          ) : hasPunched ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-secondary p-4">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">Already punched in</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Punch In</p>
                  <p className="font-semibold">{format(new Date(todayAttendance.punch_in), "hh:mm a")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Auto Punch Out</p>
                  <p className="font-semibold">06:00 PM</p>
                </div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-muted-foreground text-xs">Worked Hours</p>
                <p className="font-semibold">{todayAttendance.worked_hours} hrs</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">
                Current time: <span className="font-medium text-foreground">{format(new Date(), "hh:mm a")}</span>
              </p>
              <Button onClick={handlePunchIn} disabled={punching} size="lg" className="px-8">
                {punching ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Punch In Now
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Auto punch-out will be set to 6:00 PM
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PunchInPage;
