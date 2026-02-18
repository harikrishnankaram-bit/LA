import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Building2, Home, LogOut } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import AttendanceCalendar from "@/components/AttendanceCalendar";

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
    // Check today's attendance from new table
    const { data: att } = await supabase
      .from("attendance_daily")
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
    setPunching(true);
    try {
      // @ts-ignore
      const { data, error } = await supabase.rpc("mark_login", {
        mode_input: mode,
      });

      if (error) throw error;

      toast.success(`Logged in as ${mode} successfully!`);
      await fetchData();
    } catch (err: any) {
      if (err.message.includes("Could not find the function")) {
        toast.error("System Error: The login function is missing. Please contact Administrator.");
      } else {
        toast.error(err.message || "Failed to login");
      }
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

      toast.success("Logged out successfully!");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to logout");
    } finally {
      setPunching(false);
    }
  };

  return (
    <div>
      <h1 className="page-header mb-6">Daily Attendance</h1>

      <Card className="max-w-lg mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center gap-2 font-display text-xl">
            <Clock className="h-8 w-8 text-primary" />
            <span>{format(new Date(), "EEEE, dd MMM yyyy")}</span>
          </CardTitle>
          <p className="text-muted-foreground">
            Official Shift: 10:00 AM — 6:00 PM
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : hasApprovedLeave ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center text-yellow-800">
              <p className="font-semibold text-lg">On Leave</p>
              <p className="mt-1">You have an approved leave for today.</p>
            </div>
          ) : todayAttendance ? (
            <div className="space-y-6">
              {/* Status Banner */}
              <div
                className={`rounded-lg border px-4 py-3 text-center ${todayAttendance.status === "PRESENT"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : todayAttendance.status === "LATE"
                    ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-red-50 text-red-700 border-red-200"
                  }`}
              >
                <p className="font-bold text-lg">{todayAttendance.status}</p>
                {todayAttendance.late_minutes > 0 && (
                  <p className="text-sm">
                    Late by {Math.round(todayAttendance.late_minutes)} mins
                  </p>
                )}
              </div>

              {/* Times Grid */}
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg border p-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Login Time
                  </p>
                  <p className="font-mono text-xl font-semibold">
                    {format(new Date(todayAttendance.login_time), "hh:mm a")}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-full bg-background border">
                    {todayAttendance.mode === "WFO" ? (
                      <Building2 className="w-3 h-3" />
                    ) : (
                      <Home className="w-3 h-3" />
                    )}
                    {todayAttendance.mode}
                  </span>
                </div>
                <div className="rounded-lg border p-4 bg-muted/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Logout Time
                  </p>
                  {todayAttendance.logout_time ? (
                    <p className="font-mono text-xl font-semibold">
                      {format(new Date(todayAttendance.logout_time), "hh:mm a")}
                    </p>
                  ) : (
                    <p className="font-mono text-xl text-muted-foreground italic">
                      --:--
                    </p>
                  )}
                </div>
              </div>

              {/* Logout Action */}
              {!todayAttendance.logout_time && (
                <Button
                  onClick={handleLogout}
                  disabled={punching}
                  variant="destructive"
                  size="lg"
                  className="w-full"
                >
                  {punching ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" />
                      Mark Logout
                    </>
                  )}
                </Button>
              )}

              {todayAttendance.logout_time && (
                <div className="text-center text-muted-foreground text-sm">
                  Shift completed.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleLogin("WFO")}
                  disabled={punching}
                  size="lg"
                  className="h-24 flex-col gap-2 border-2 hover:border-primary/50"
                  variant="outline"
                >
                  <Building2 className="h-8 w-8 text-primary" />
                  <span className="font-semibold">Work From Office</span>
                </Button>

                <Button
                  onClick={() => handleLogin("WFH")}
                  disabled={punching}
                  size="lg"
                  className="h-24 flex-col gap-2 border-2 hover:border-primary/50"
                  variant="outline"
                >
                  <Home className="h-8 w-8 text-primary" />
                  <span className="font-semibold">Work From Home</span>
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                By logging in, you confirm your improved attendance status.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <AttendanceCalendar />
      </div>
    </div>
  );
};

export default PunchInPage;
