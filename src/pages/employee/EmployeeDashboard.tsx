import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, CalendarDays, CheckCircle, XCircle, Home, Building2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, isSameDay } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

    const fetchData = async () => {
      setLoading(true);

      // Fetch today's attendance
      const { data: todayData } = await supabase
        .from("attendance_daily")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      setTodayAttendance(todayData);

      // Fetch weekly data for pie chart
      const { data: weekData } = await supabase
        .from("attendance_daily")
        .select("status, mode")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end);

      if (weekData) {
        // Process data for pie chart
        const stats = {
          Present: 0,
          Late: 0,
          Absent: 0,
          WFH: 0,
          WFO: 0
        };

        weekData.forEach((record: any) => {
          if (record.status === "PRESENT") stats.Present++;
          else if (record.status === "LATE") stats.Late++;
          else if (record.status === "ABSENT") stats.Absent++;

          if (record.mode === "WFH") stats.WFH++;
          else if (record.mode === "WFO") stats.WFO++;
        });

        // Calculate Absent days (assuming 5 working days so far or remaining)
        // For simplicity, just showing recorded statuses. 
        // A more complex logic would be to fill in missing days as Absent if they are in the past.

        setWeeklyData([
          { name: "Present", value: stats.Present, color: "#22c55e" }, // green-500
          { name: "Late", value: stats.Late, color: "#f97316" }, // orange-500
          { name: "Absent", value: stats.Absent, color: "#ef4444" }, // red-500
          { name: "WFH", value: stats.WFH, color: "#3b82f6" }, // blue-500
          { name: "WFO", value: stats.WFO, color: "#a855f7" }, // purple-500
        ].filter(d => d.value > 0));
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
    PRESENT: { label: "Present", class: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
    LATE: { label: "Late", class: "bg-orange-100 text-orange-700 border-orange-200", icon: Clock },
    ABSENT: { label: "Absent", class: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  };

  const status = todayAttendance?.status || "ABSENT";
  // Default to absent config if status not found or null
  const config = statusConfig[status] || statusConfig.ABSENT;
  const StatusIcon = config.icon;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-2 shadow-sm text-xs">
          <p className="font-semibold">{payload[0].name}</p>
          <p>{payload[0].value} days</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h1 className="page-header mb-6">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Date Card */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Today's Date</p>
              <h3 className="text-2xl font-bold">{format(new Date(), "dd MMM")}</h3>
              <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, yyyy")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Login Time Card */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${todayAttendance?.login_time ? 'bg-green-100' : 'bg-muted'}`}>
              <Clock className={`h-6 w-6 ${todayAttendance?.login_time ? 'text-green-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Login Time</p>
              <h3 className="text-2xl font-bold">
                {todayAttendance?.login_time
                  ? format(new Date(todayAttendance.login_time), "hh:mm a")
                  : "--:--"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {todayAttendance?.mode ? (todayAttendance.mode === 'WFO' ? 'Work From Office' : 'Work From Home') : 'Not logged in'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${todayAttendance ? 'bg-blue-100' : 'bg-muted'}`}>
              <StatusIcon className={`h-6 w-6 ${todayAttendance ? 'text-blue-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Status</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.class}`}>
                  {config.label}
                </span>
                {todayAttendance?.late_minutes > 0 && (
                  <span className="text-xs text-orange-600 font-medium">
                    +{Math.round(todayAttendance.late_minutes)}m late
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mode Card */}
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
              {todayAttendance?.mode === 'WFH' ? <Home className="h-6 w-6 text-purple-600" /> : <Building2 className="h-6 w-6 text-purple-600" />}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Work Mode</p>
              <h3 className="text-lg font-bold">
                {todayAttendance?.mode || "N/A"}
              </h3>
              <p className="text-xs text-muted-foreground">Today's location</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-2">
        {/* Weekly Progress Chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Weekly Attendance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full flex items-center justify-center">
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={weeklyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {weeklyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  No attendance data for this week yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity / Summary or any other widget */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Total Days Present (This Week)</p>
                  <p className="text-xs text-muted-foreground">Includes WFO & WFH</p>
                </div>
                <div className="text-2xl font-bold">
                  {weeklyData.find(d => d.name === 'Present')?.value || 0}
                </div>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Late Arrivals</p>
                  <p className="text-xs text-muted-foreground">Grace period exceeded</p>
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {weeklyData.find(d => d.name === 'Late')?.value || 0}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Work From Home</p>
                  <p className="text-xs text-muted-foreground">Remote days taken</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {weeklyData.find(d => d.name === 'WFH')?.value || 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
