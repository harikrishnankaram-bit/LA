import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const AttendanceOverview = () => {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("role", "employee").order("full_name");
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-overview", date, employeeFilter],
    queryFn: async () => {
      let query = supabase.from("attendance").select("*, profiles!inner(full_name, department)").eq("date", date);
      if (employeeFilter !== "all") query = query.eq("user_id", employeeFilter);
      const { data } = await query.order("created_at");
      return data || [];
    },
  });

  return (
    <div>
      <h1 className="page-header mb-6">Attendance Overview</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Employee</Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e: any) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Attendance — {format(new Date(date), "dd MMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No records found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Punch In</TableHead>
                  <TableHead>Punch Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a: any) => {
                  const cls = a.status === "present" ? "badge-present" : a.status === "half_day" ? "badge-half-day" : a.status === "on_leave" ? "badge-on-leave" : "badge-absent";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{(a as any).profiles?.full_name}</TableCell>
                      <TableCell className="text-sm">{(a as any).profiles?.department}</TableCell>
                      <TableCell className="text-sm">{a.punch_in ? format(new Date(a.punch_in), "hh:mm a") : "—"}</TableCell>
                      <TableCell className="text-sm">{a.punch_out ? format(new Date(a.punch_out), "hh:mm a") : "—"}</TableCell>
                      <TableCell className="text-sm">{a.worked_hours || 0}</TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
                          {a.status?.replace("_", " ")}
                        </span>
                      </TableCell>
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

export default AttendanceOverview;
