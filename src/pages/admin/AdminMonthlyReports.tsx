import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, Download, Users, Briefcase, Calendar, Zap, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const AdminMonthlyReports = () => {
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState("all");
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

  const filteredEmployees = selectedCompany === "all" ? employees : employees.filter((e: any) => e.company === selectedCompany);

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["admin-report", selectedEmployee, selectedCompany, startDate, employees.length],
    queryFn: async () => {
      if (employees.length === 0) return [];

      let query = supabase
        .from("attendance_daily")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (selectedEmployee !== "all" && selectedEmployee !== "") {
        query = query.eq("user_id", selectedEmployee);
      } else {
        const allowedIds = filteredEmployees.map((e: any) => e.user_id);
        if (allowedIds.length === 0) return [];
        query = query.in("user_id", allowedIds);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: employees.length > 0,
  });

  const presentDays = attendance.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length;
  const lateDays = attendance.filter((a: any) => a.status === "LATE").length;
  const absentDays = attendance.filter((a: any) => a.status === "ABSENT" && a.mode !== "LEAVE").length;
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
    const headers = "Employee Name,Company,Date,Login Time,Logout Time,Hours,Status,Mode\n";
    const rows = attendance.map((a: any) => {
      const emp = employees.find((e: any) => e.user_id === a.user_id);
      let hours = 0;
      if (a.login_time && a.logout_time) {
        hours = (new Date(a.logout_time).getTime() - new Date(a.login_time).getTime()) / (1000 * 60 * 60);
      }
      return `"${emp?.full_name || ""}","${emp?.company || ""}",${a.date},${a.login_time ? format(new Date(a.login_time), "hh:mm a") : ""},${a.logout_time ? format(new Date(a.logout_time), "hh:mm a") : ""},${hours.toFixed(2)},${a.status},${a.mode}`;
    }).join("\n");
    const summary = `\n\nSummary\nExpected Days in Month,${totalDays}\nCombined Present,${presentDays}\nCombined Late,${lateDays}\nCombined Absent,${absentDays}\nCombined Leave,${leaveDays}\nTotal Combined Hours,${totalWorked.toFixed(1)}\nAvg Hours/Day,${avgHours}`;
    const blob = new Blob([headers + rows + summary], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const prefix = selectedEmployee !== "all" ? employees.find((e: any) => e.user_id === selectedEmployee)?.full_name : selectedCompany !== "all" ? selectedCompany : "All_Companies";
    a.download = `${prefix}_${months[selectedMonth]}_${year}.csv`;
    a.click();
  };

  const getStatusStyle = (status: string, mode: string) => {
    if (mode === "LEAVE") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
    if (status === "PRESENT") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (status === "LATE") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          Monthly <span className="text-blue-500">Reports</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Monthly Analytics</p>
      </div>

      <Card className="glass-card border-border shadow-2xl bg-card/50 backdrop-blur-xl overflow-visible">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company Filter</Label>
              <Select value={selectedCompany} onValueChange={(val) => { setSelectedCompany(val); setSelectedEmployee("all"); }}>
                <SelectTrigger className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-blue-500/50">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all" className="font-bold">All Companies</SelectItem>
                  <SelectItem value="Vaazhai" className="font-bold">Vaazhai</SelectItem>
                  <SelectItem value="Aram" className="font-bold">Aram</SelectItem>
                  <SelectItem value="Raphael Creatives" className="font-bold">Raphael Creatives</SelectItem>
                  <SelectItem value="Kottravai" className="font-bold">Kottravai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-blue-500/50">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all" className="font-bold">All Employees</SelectItem>
                  {filteredEmployees.map((e: any) => (
                    <SelectItem key={e.user_id} value={e.user_id} className="font-bold">{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Report Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-blue-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)} className="font-bold">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                onClick={downloadCSV}
                disabled={attendance.length === 0}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[11px] tracking-widest shadow-lg shadow-emerald-500/10 border-none transition-all"
              >
                <Download className="mr-2 h-4 w-4" /> Export Report (CSV)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {attendance.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {[
                { label: "Total Days", value: totalDays, icon: Calendar, color: "text-blue-500" },
                { label: "Present", value: presentDays, icon: Users, color: "text-emerald-500" },
                { label: "Late", value: lateDays, icon: Zap, color: "text-amber-500" },
                { label: "Absent", value: absentDays, icon: Activity, color: "text-red-500" },
                { label: "Leave", value: leaveDays, icon: Briefcase, color: "text-purple-500" },
                { label: "Work Hours", value: totalWorked.toFixed(1), icon: Zap, color: "text-indigo-500" },
                { label: "Avg/Day", value: avgHours, icon: Activity, color: "text-teal-500" },
              ].map((s) => (
                <Card key={s.label} className="glass-card border-border shadow-sm bg-card/30 backdrop-blur-md overflow-hidden group">
                  <CardContent className="p-4 flex flex-col items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                    <s.icon className={`${s.color} h-4 w-4 opacity-50`} />
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">{s.label}</p>
                    <p className="text-xl font-black text-foreground italic uppercase tracking-tighter">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="glass-card border-border shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
              <CardHeader className="bg-secondary/30 border-b border-border/50 px-8 py-6">
                <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase text-foreground flex items-center gap-3">
                  <FileBarChart className="h-5 w-5 text-blue-500" />
                  Detailed Report
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20 h-16 border-b border-border/50">
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-8">Employee</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Company</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">In</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Out</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Duration</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pr-8">Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((a: any) => {
                      const emp = employees.find((e: any) => e.user_id === a.user_id);
                      let hours = 0;
                      if (a.login_time && a.logout_time) {
                        hours = (new Date(a.logout_time).getTime() - new Date(a.login_time).getTime()) / (1000 * 60 * 60);
                      }
                      return (
                        <TableRow key={a.id} className="h-16 hover:bg-secondary/10 border-b border-border/30 transition-colors">
                          <TableCell className="font-black text-sm text-foreground uppercase italic tracking-tighter pl-8">{emp?.full_name || "Unknown"}</TableCell>
                          <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{emp?.company || "-"}</TableCell>
                          <TableCell className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{format(new Date(a.date), "dd MMM")}</TableCell>
                          <TableCell className="text-[10px] font-mono font-bold text-foreground">{a.login_time ? format(new Date(a.login_time), "HH:mm") : "—"}</TableCell>
                          <TableCell className="text-[10px] font-mono font-bold text-foreground">{a.logout_time ? format(new Date(a.logout_time), "HH:mm") : "—"}</TableCell>
                          <TableCell className="text-[10px] font-mono font-bold text-blue-500">
                            {(() => {
                              if (a.login_time && a.logout_time) {
                                const diff = new Date(a.logout_time).getTime() - new Date(a.login_time).getTime();
                                const hrs = Math.floor(diff / (1000 * 60 * 60));
                                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                return `${hrs}h ${mins}m`;
                              }
                              return "—";
                            })()}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border shrink-0 ${getStatusStyle(a.status, a.mode)}`}>
                              {a.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-[10px] font-black uppercase text-muted-foreground pr-8">{a.mode || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        ) : !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="glass-card border-border bg-card/30 backdrop-blur-lg border-dashed">
              <CardContent className="py-24 text-center flex flex-col items-center gap-4 opacity-30">
                <FileBarChart size={48} className="text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">No records found</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMonthlyReports;
