import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    supabase
      .from("attendance")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => {
        setTodayAttendance(data);
        setLoading(false);
      });
  }, [user]);

  const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
    present: { label: "Present", class: "badge-present", icon: CheckCircle },
    half_day: { label: "Half Day", class: "badge-half-day", icon: Clock },
    absent: { label: "Absent", class: "badge-absent", icon: XCircle },
    on_leave: { label: "On Leave", class: "badge-on-leave", icon: CalendarDays },
  };

  const status = todayAttendance?.status || "absent";
  const config = statusConfig[status] || statusConfig.absent;
  const StatusIcon = config.icon;

  return (
    <div>
      <h1 className="page-header mb-6">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Today's Date</p>
                <p className="text-sm font-semibold">{format(new Date(), "dd MMM yyyy")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Punch In Time</p>
                <p className="text-sm font-semibold">
                  {todayAttendance?.punch_in
                    ? format(new Date(todayAttendance.punch_in), "hh:mm a")
                    : "Not punched in"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Auto Punch Out</p>
                <p className="text-sm font-semibold">06:00 PM</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <StatusIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.class}`}>
                  {config.label}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {todayAttendance && (
        <Card className="mt-6 stat-card">
          <CardContent className="p-0">
            <h3 className="font-display text-sm font-semibold mb-2">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Worked Hours:</span>
                <span className="ml-2 font-medium">{todayAttendance.worked_hours || 0} hrs</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${config.class}`}>
                  {config.label}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmployeeDashboard;
