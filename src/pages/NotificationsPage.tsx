import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { format } from "date-fns";

const NotificationsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read_status: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read_status: true }).eq("user_id", user!.id).eq("read_status", false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase mb-0">
            System <span className="text-blue-500">Alerts</span>
          </h1>
          <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Real-time Information Relay</p>
        </div>
        {notifications.some((n: any) => !n.read_status) && (
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            className="rounded-xl border-border bg-background/50 backdrop-blur-md text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all"
          >
            <Check className="mr-1.5 h-3.5 w-3.5 text-blue-500" />Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="glass-card border-border shadow-sm bg-card/50 backdrop-blur-lg">
          <CardContent className="p-0 text-center py-24 flex flex-col items-center gap-4 opacity-50">
            <Bell className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-xs font-black uppercase tracking-widest text-foreground">Operational archive empty</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {notifications.map((n: any) => (
            <Card key={n.id} className={`glass-card border-border overflow-hidden transition-all duration-300 ${!n.read_status ? "bg-blue-500/5 shadow-md shadow-blue-500/5" : "bg-card/30 opacity-80"}`}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-start gap-4">
                  <div className={`mt-1.5 h-2 w-2 rounded-full ${!n.read_status ? 'bg-blue-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <div>
                    <p className={`text-sm tracking-tight ${!n.read_status ? "font-black text-foreground" : "text-muted-foreground font-medium"}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase mt-2 font-bold tracking-tight">
                      {format(new Date(n.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>
                </div>
                {!n.read_status && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => markAsRead(n.id)}
                    className="h-10 w-10 rounded-xl hover:bg-blue-500/10 text-blue-500 transition-colors"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
