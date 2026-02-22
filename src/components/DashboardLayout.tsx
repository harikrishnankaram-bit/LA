import AppSidebar from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          toast(payload.new.message, {
            icon: <Bell className="h-4 w-4 text-emerald-500" />,
            duration: 5000,
            className: "glass-card border-emerald-500/20"
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-500">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden dark:bg-black/80"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.div
        className={`fixed inset-y-0 left-0 z-[70] w-72 transform shadow-2xl transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <AppSidebar onClose={() => setSidebarOpen(false)} />

        {/* Mobile Close Button */}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-4 -right-12 p-2 bg-emerald-500 text-white rounded-full md:hidden shadow-lg border-2 border-white/20"
          >
            <X size={20} />
          </button>
        )}
      </motion.div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full h-full overflow-hidden relative">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-info/5 blur-[120px] pointer-events-none" />

        {/* Mobile Header Box */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-xl z-50">
          <div className="flex items-center gap-2 max-w-[70%]">
            <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 border border-primary/20 shadow-lg">
              <img
                src={`/${profile?.company || "logo"}.png`}
                alt=""
                className="h-full w-full object-contain p-1"
                onError={(e) => {
                  if (e.currentTarget.src.includes('logo.png')) {
                    e.currentTarget.style.display = 'none';
                  } else {
                    e.currentTarget.src = "/logo.png";
                  }
                }}
              />
              {!profile?.company && <span className="font-black text-xs text-white">V</span>}
            </div>
            <h1 className="font-display text-lg font-black tracking-tighter text-foreground uppercase whitespace-nowrap">
              {profile?.company || "VAAZHAI"} <span className="text-emerald-500">TIME KEEPER</span>
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-emerald-500">
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto relative z-10 scrollbar-hide">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="max-w-[1600px] mx-auto p-4 sm:p-8 lg:p-12 pb-24"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
