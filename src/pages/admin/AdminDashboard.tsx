import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CalendarDays, AlertTriangle } from "lucide-react";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const [employees, todayAtt, pendingLeaves] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "employee"),
        supabase.from("attendance").select("*").eq("date", today),
        supabase.from("leaves").select("*", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      const attData = todayAtt.data || [];
      return {
        totalEmployees: employees.count || 0,
        presentToday: attData.filter((a: any) => a.status === "present").length,
        halfDayToday: attData.filter((a: any) => a.status === "half_day").length,
        absentToday: (employees.count || 0) - attData.filter((a: any) => a.status !== "absent").length,
        pendingLeaves: pendingLeaves.count || 0,
      };
    },
  });

  const cards = [
    { label: "Total Employees", value: stats?.totalEmployees || 0, icon: Users, color: "text-primary" },
    { label: "Present Today", value: stats?.presentToday || 0, icon: Clock, color: "text-primary" },
    { label: "Half Day", value: stats?.halfDayToday || 0, icon: CalendarDays, color: "text-warning" },
    { label: "Pending Leaves", value: stats?.pendingLeaves || 0, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div>
      <h1 className="page-header mb-6">Admin Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="stat-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold font-display">{c.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
