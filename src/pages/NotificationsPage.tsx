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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-header">Notifications</h1>
        {notifications.some((n: any) => !n.read_status) && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <Check className="mr-1.5 h-3.5 w-3.5" />Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="stat-card">
          <CardContent className="p-0 text-center py-8">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No notifications</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card key={n.id} className={`transition-colors ${!n.read_status ? "border-primary/30 bg-primary/5" : ""}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className={`text-sm ${!n.read_status ? "font-medium" : "text-muted-foreground"}`}>{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(n.created_at), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
                {!n.read_status && (
                  <Button variant="ghost" size="sm" onClick={() => markAsRead(n.id)}>
                    <Check className="h-3.5 w-3.5" />
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
