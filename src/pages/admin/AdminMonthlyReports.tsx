import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const AdminMonthlyReports = () => {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth()));

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("role", "employee").order("full_name");
      return data || [];
    },
  });

  const selectedMonth = parseInt(month);
  const year = new Date().getFullYear();
  const startDate = format(startOfMonth(new Date(year, selectedMonth)), "yyyy-MM-dd");
  const endDate = format(endOfMonth(new Date(year, selectedMonth)), "yyyy-MM-dd");
  const totalDays = getDaysInMonth(new Date(year, selectedMonth));

  const { data: attendance = [] } = useQuery({
    queryKey: ["admin-report", selectedEmployee, startDate],
    queryFn: async () => {
      if (!selectedEmployee) return [];
      const { data } = await supabase
        .from("attendance_daily")
        .select("*")
        .eq("user_id", selectedEmployee)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");
      return data || [];
    },
    enabled: !!selectedEmployee,
  });

  const presentDays = attendance.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length;
  const lateDays = attendance.filter((a: any) => a.status === "LATE").length;
  // Absent is when status is ABSENT but NOT on leave (mode != LEAVE)
  const absentDays = attendance.filter((a: any) => a.status === "ABSENT" && a.mode !== "LEAVE").length;
  // Leave is when mode is LEAVE (status should be ABSENT implicitly, but mode is the key)
  const leaveDays = attendance.filter((a: any) => a.mode === "LEAVE").length;

  const totalWorked = attendance.reduce((sum: number, a: any) => {
    if (a.login_time && a.logout_time) {
      const start = new Date(a.login_time).getTime();
      const end = new Date(a.logout_time).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  const avgHours = presentDays > 0 ? (totalWorked / presentDays).toFixed(1) : "0";

  const downloadCSV = () => {
    if (!attendance.length) return;
    const emp = employees.find((e: any) => e.user_id === selectedEmployee);
    const headers = "Date,Login Time,Logout Time,Hours,Status,Mode\n";
    const rows = attendance.map((a: any) => {
      let hours = 0;
      if (a.login_time && a.logout_time) {
        hours = (new Date(a.logout_time).getTime() - new Date(a.login_time).getTime()) / (1000 * 60 * 60);
      }
      return `${a.date},${a.login_time ? format(new Date(a.login_time), "hh:mm a") : ""},${a.logout_time ? format(new Date(a.logout_time), "hh:mm a") : ""},${hours.toFixed(2)},${a.status},${a.mode}`;
    }).join("\n");
    const summary = `\n\nSummary\nTotal Days,${totalDays}\nPresent,${presentDays}\nLate,${lateDays}\nAbsent,${absentDays}\nLeave,${leaveDays}\nTotal Hours,${totalWorked.toFixed(1)}\nAvg Hours/Day,${avgHours}`;
    const blob = new Blob([headers + rows + summary], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${emp?.full_name || "report"}_${months[selectedMonth]}_${year}.csv`;
    a.click();
  };

  return (
    <div>
      <h1 className="page-header mb-6">Monthly Reports</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Employee</Label>
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>
              {employees.map((e: any) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        {attendance.length > 0 && (
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={downloadCSV}>
              <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
            </Button>
          </div>
        )}
      </div>

      {selectedEmployee && attendance.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7 mb-6">
            {[
              { label: "Total Days", value: totalDays },
              { label: "Present", value: presentDays },
              { label: "Late", value: lateDays },
              { label: "Absent", value: absentDays },
              { label: "Leave", value: leaveDays },
              { label: "Total Hours", value: totalWorked.toFixed(1) },
              { label: "Avg Hrs/Day", value: avgHours },
            ].map((s) => (
              <Card key={s.label} className="stat-card">
                <CardContent className="p-0 text-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold font-display">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-primary" />Daily Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  {attendance.map((a: any) => {
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
            </CardContent>
          </Card>
        </>
      )}

      {selectedEmployee && attendance.length === 0 && (
        <Card className="stat-card">
          <CardContent className="p-0 text-center py-8">
            <p className="text-muted-foreground">No records found for selected employee and month</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMonthlyReports;
