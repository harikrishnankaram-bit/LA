import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileBarChart, Calendar, Zap, Activity, Briefcase, Users, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EmployeeMonthlyReport = () => {
  const { user } = useAuth();
  const currentMonth = new Date().getMonth();
  const [month, setMonth] = useState(String(currentMonth));

  const selectedMonth = parseInt(month);
  const selectedYear = new Date().getFullYear();
  const startDate = format(startOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
  const endDate = format(endOfMonth(new Date(selectedYear, selectedMonth)), "yyyy-MM-dd");
  const totalDays = getDaysInMonth(new Date(selectedYear, selectedMonth));

  const { data: attendanceData = [], isLoading } = useQuery({
    queryKey: ["my-monthly-report", user?.id, startDate, endDate],
    queryFn: async () => {
      const { data: attData } = await supabase
        .from("attendance_daily")
        .select("*")
        .eq("user_id", user!.id)
        .gte("date", startDate)
        .lte("date", endDate);

      const { data: leaveData } = await supabase
        .from("leaves")
        .select("from_date, to_date, status")
        .eq("user_id", user!.id)
        .eq("status", "APPROVED")
        .lte("from_date", endDate)
        .gte("to_date", startDate);

      const attMap = (attData || []).reduce((acc: any, a) => {
        acc[a.date] = a;
        return acc;
      }, {});

      const todayStr = format(new Date(), "yyyy-MM-dd");
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(11, 30, 0, 0);

      const allDays: any[] = [];
      const daysCount = getDaysInMonth(new Date(selectedYear, selectedMonth));
      
      for (let i = 1; i <= daysCount; i++) {
        const currentDate = new Date(selectedYear, selectedMonth, i);
        const dateStr = format(currentDate, "yyyy-MM-dd");
        
        // Skip future dates
        if (dateStr > todayStr) continue;

        if (attMap[dateStr]) {
          allDays.push(attMap[dateStr]);
        } else {
          // Check if it's an approved leave
          const isApprovedLeave = (leaveData || []).some(l => 
            dateStr >= l.from_date && dateStr <= l.to_date
          );

          let status = "LEAVE";
          if (dateStr === todayStr && now < cutoff) {
            status = "NOT PUNCHED";
          }

          allDays.push({
            id: `virtual-${dateStr}`,
            date: dateStr,
            status: status,
            mode: isApprovedLeave ? "LEAVE" : "LEAVE", // As per user request: "if not present make that day as leave"
            login_time: null,
            logout_time: null
          });
        }
      }

      return allDays.sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: !!user,
  });

  const presentDays = attendanceData.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length;
  const lateDays = attendanceData.filter((a: any) => a.status === "LATE").length;
  const leaveDays = attendanceData.filter((a: any) => a.status === "LEAVE").length;
  // Absent is effectively 0 now as they are all Leave
  const absentDays = attendanceData.filter((a: any) => a.status === "ABSENT").length;

  const totalWorked = attendanceData.reduce((sum: number, a: any) => {
    if (a.login_time && a.logout_time) {
      const start = new Date(a.login_time).getTime();
      const end = new Date(a.logout_time).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  const getStatusStyle = (status: string, mode: string) => {
    if (status === "LEAVE" || mode === "LEAVE") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    if (status === "PRESENT") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    if (status === "LATE") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    if (status === "NOT PUNCHED") return "bg-slate-500/10 text-muted-foreground border-slate-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          My <span className="text-emerald-500">Reports</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Monthly Attendance</p>
      </div>

      <Card className="glass-card border-border shadow-2xl bg-card/50 backdrop-blur-xl overflow-visible">
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-end gap-6">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="h-14 bg-background border-border rounded-xl text-foreground font-bold focus:ring-emerald-500/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {months.map((m, i) => (
                    <SelectItem key={i} value={String(i)} className="font-bold">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 text-right sm:text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Current Month</p>
              <p className="text-2xl font-black italic uppercase italic text-foreground">{months[selectedMonth]} {selectedYear}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Days", value: totalDays, icon: Calendar, color: "text-blue-500" },
          { label: "Present", value: presentDays, icon: Users, color: "text-emerald-500" },
          { label: "Late", value: lateDays, icon: Zap, color: "text-amber-500" },
          { label: "Absent", value: absentDays, icon: Activity, color: "text-red-500" },
          { label: "On Leave", value: leaveDays, icon: Briefcase, color: "text-purple-500" },
          { label: "Total Hours", value: totalWorked.toFixed(1), icon: Clock, color: "text-indigo-500" },
        ].map((s) => (
          <Card key={s.label} className="glass-card border-border shadow-sm bg-card/30 backdrop-blur-md overflow-hidden group">
            <CardContent className="p-4 flex flex-col items-center justify-center gap-2 group-hover:scale-105 transition-transform">
              <s.icon className={`${s.color} h-4 w-4 opacity-50`} strokeWidth={3} />
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center">{s.label}</p>
              <p className="text-xl font-black text-foreground italic uppercase tracking-tighter">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-border shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b border-border/50 px-8 py-6">
          <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase text-foreground flex items-center gap-3">
            <FileBarChart className="h-5 w-5 text-emerald-500" />
            Personal Attendance Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AnimatePresence mode="wait">
            {attendanceData.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 text-center flex flex-col items-center gap-4 opacity-30"
              >
                <Activity size={48} className="text-muted-foreground" />
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground">No attendance records found for this month</p>
              </motion.div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20 h-16 border-b border-border/50">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-8 italic">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Punch In</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Punch Out</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Duration</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground italic">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pr-8 italic text-right">Work Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((a: any) => {
                    let hours = 0;
                    if (a.login_time && a.logout_time) {
                      hours = (new Date(a.logout_time).getTime() - new Date(a.login_time).getTime()) / (1000 * 60 * 60);
                    }
                    return (
                      <TableRow key={a.id} className="h-16 hover:bg-secondary/10 border-b border-border/30 transition-colors">
                        <TableCell className="text-[11px] font-mono font-bold text-muted-foreground uppercase pl-8 italic">{format(new Date(a.date), "dd MMM, yyyy")}</TableCell>
                        <TableCell className="text-[11px] font-mono font-bold text-foreground">{a.login_time ? format(new Date(a.login_time), "HH:mm") : "—"}</TableCell>
                        <TableCell className="text-[11px] font-mono font-bold text-foreground">{a.logout_time ? format(new Date(a.logout_time), "HH:mm") : "—"}</TableCell>
                        <TableCell className="text-[11px] font-mono font-black text-emerald-500 uppercase">
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
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border shrink-0 ${getStatusStyle(a.status, a.mode)}`}>
                            {a.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-[10px] font-black uppercase text-muted-foreground pr-8 text-right italic">{a.mode || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeMonthlyReport;
