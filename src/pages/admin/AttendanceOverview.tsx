import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Calendar, Database, Activity, UserCheck, ShieldAlert, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

const AttendanceOverview = () => {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [employeeFilter, setEmployeeFilter] = useState("all");

  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ["all-employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, department")
        .eq("role", "employee")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attendance = [], isLoading: loadingAtt, error: attError } = useQuery({
    queryKey: ["attendance-overview", date, employeeFilter],
    queryFn: async () => {
      console.log("Fetching attendance:", { date, filter: employeeFilter });

      let attQuery = supabase
        .from("attendance_daily")
        .select("*")
        .eq("date", date);

      if (employeeFilter !== "all") {
        attQuery = attQuery.eq("user_id", employeeFilter);
      }

      const { data: attData, error: attErr } = await attQuery.order("login_time", { ascending: false });
      if (attErr) throw attErr;
      if (!attData || attData.length === 0) return [];

      const userIds = [...new Set(attData.map(a => a.user_id))];
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, department")
        .in("user_id", userIds);

      if (profErr) console.warn("Profile sync error:", profErr);

      const profileMap = (profData || []).reduce((acc: any, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {});

      return attData.map(a => ({
        ...a,
        profiles: profileMap[a.user_id] || { full_name: "Unknown Employee", department: "Unassigned" }
      }));
    },
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "PRESENT": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "LATE": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "ABSENT": return "bg-red-500/10 text-red-500 border-red-500/20";
      default: return "bg-slate-500/10 text-muted-foreground border-border";
    }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
          Attendance <span className="text-emerald-500">Overview</span>
        </h1>
        <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Real-time Attendance</p>
      </div>

      <div className="flex flex-wrap items-end gap-6 p-6 bg-secondary/30 backdrop-blur-md rounded-2xl border border-border shadow-sm">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 ml-1 flex items-center gap-2">
            <Calendar size={12} /> Date
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-56 h-12 bg-background border-border text-foreground font-bold rounded-xl focus:ring-emerald-500/50"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 ml-1 flex items-center gap-2">
            <Users size={12} /> Employee Filter
          </Label>
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-64 h-12 bg-background border-border text-foreground font-bold rounded-xl focus:ring-emerald-500/50">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e: any) => (
                <SelectItem key={e.user_id} value={e.user_id} className="hover:bg-secondary font-bold">
                  {e.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 flex justify-end">
          <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full bg-emerald-500 ${loadingAtt ? 'animate-ping' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
              {loadingAtt ? 'Syncing...' : 'System Online'}
            </span>
          </div>
        </div>
      </div>

      <Card className="glass-card border-border shadow-sm overflow-hidden bg-card/30 backdrop-blur-lg">
        <CardHeader className="bg-secondary/30 border-b border-border py-4 px-8 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2 text-foreground">
            <Database className="h-4 w-4 text-emerald-500" />
            Attendance Records — {format(new Date(date), "dd MMM yyyy")}
          </CardTitle>
          {attendance.length > 0 && (
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {attendance.length} Record(s) Found
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingAtt ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Activity className="h-10 w-10 text-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Loading Data</p>
            </div>
          ) : attError ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-red-500">
              <ShieldAlert size={48} />
              <p className="text-xs font-black uppercase tracking-widest">Error loading data</p>
            </div>
          ) : attendance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-6 opacity-30">
              <Zap size={60} className="text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-foreground">No Records</p>
                <p className="text-[10px] font-medium mt-2 text-muted-foreground">No attendance records found for this date.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6 pl-8">Employee Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6">Department</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6">Punch In</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6">Punch Out</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6">Duration</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground py-6 pr-8 text-right">Work Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((a: any) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-border hover:bg-secondary/10 transition-colors"
                    >
                      <TableCell className="py-6 pl-8">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center font-black text-emerald-600 border border-emerald-500/20 shadow-sm">
                            {(a.profiles as any)?.full_name?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground tracking-tight uppercase">{(a.profiles as any)?.full_name || "Unknown Employee"}</p>
                            <p className="text-[10px] font-mono text-muted-foreground mt-1 uppercase">ID: {a.user_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none">
                        {(a.profiles as any)?.department || "Unassigned"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-emerald-600 font-bold">
                        {a.login_time ? format(new Date(a.login_time), "HH:mm:ss") : "— — : — —"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-info font-bold">
                        {a.logout_time ? format(new Date(a.logout_time), "HH:mm:ss") : "LOG-OUT PENDING"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-blue-500 font-bold">
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
                        <span className={`inline-flex items-center px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${getStatusStyle(a.status)}`}>
                          {a.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <span className="inline-flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1 text-[10px] font-black text-muted-foreground border border-border uppercase tracking-tighter">
                          {a.mode || "STATIC"}
                        </span>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceOverview;
