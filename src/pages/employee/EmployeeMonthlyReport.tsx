import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileBarChart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EmployeeMonthlyReport = () => {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(String(currentMonth));
  const [year] = useState(String(currentYear));

  const selectedMonth = parseInt(month);
  const selectedYear = parseInt(year);
  const startDate = format(startOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
  const endDate = format(endOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
  const totalDays = getDaysInMonth(new Date(selectedYear, selectedMonth));

  const { data: attendanceData = [] } = useQuery({
    queryKey: ["my-monthly-report", user?.id, startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance_daily")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      return data || [];
    },
    enabled: !!user,
  });

  const presentDays = attendanceData.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length;
  const lateDays = attendanceData.filter((a: any) => a.status === "LATE").length;
  const leaveDays = attendanceData.filter((a: any) => a.mode === "LEAVE").length;
  const absentDays = attendanceData.filter((a: any) => a.status === "ABSENT" && a.mode !== "LEAVE").length;

  const totalWorked = attendanceData.reduce((sum: number, a: any) => {
    if (a.login_time && a.logout_time) {
      const start = new Date(a.login_time).getTime();
      const end = new Date(a.logout_time).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  return (
    <div>
      <h1 className="page-header mb-6">My Monthly Report</h1>

      <div className="mb-6 flex gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Month</Label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        {[
          { label: "Total Days", value: totalDays },
          { label: "Present", value: presentDays },
          { label: "Late", value: lateDays },
          { label: "Absent", value: absentDays },
          { label: "On Leave", value: leaveDays },
          { label: "Total Hours", value: totalWorked.toFixed(1) },
        ].map((s) => (
          <Card key={s.label} className="stat-card">
            <CardContent className="p-0 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold font-display">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-primary" />
            Daily Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No attendance records for this month</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Login Time</TableHead>
                  <TableHead>Logout Time</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mode</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((a: any) => {
                  const cls = a.status === "PRESENT" ? "badge-present" : a.status === "LATE" ? "badge-half-day" : a.mode === "LEAVE" ? "badge-on-leave" : "badge-absent";
                  let hours = 0;
                  if (a.login_time && a.logout_time) {
                    hours = (new Date(a.logout_time).getTime() - new Date(a.login_time).getTime()) / (1000 * 60 * 60);
                  }
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm">{format(new Date(a.date), "dd MMM")}</TableCell>
                      <TableCell className="text-sm">{a.login_time ? format(new Date(a.login_time), "hh:mm a") : "—"}</TableCell>
                      <TableCell className="text-sm">{a.logout_time ? format(new Date(a.logout_time), "hh:mm a") : "—"}</TableCell>
                      <TableCell className="text-sm">{hours > 0 ? hours.toFixed(1) : 0}</TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{a.mode || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeMonthlyReport;
