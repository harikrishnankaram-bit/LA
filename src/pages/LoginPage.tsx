import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface LoginProps {
  isAdmin?: boolean;
}

const LoginPage = ({ isAdmin = false }: LoginProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, profile, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user && profile) {
      if (profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (profile.role === "employee") {
        if (isAdmin) {
          toast.error("Access restriction: Employees cannot log in via Admin portal.");
          navigate("/employee", { replace: true });
        } else {
          navigate("/employee", { replace: true });
        }
      }
    }
  }, [user, profile, navigate, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent shadow-lg"
        />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter username and password");
      return;
    }
    setIsLoading(true);
    try {
      await signIn(username.trim(), password);
      toast.success("Welcome back!", {
        description: "Login successful.",
        icon: <LogIn className="h-4 w-4 text-green-500" />
      });
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  const setupAdmin = async () => {
    setIsLoading(true);
    try {
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        toast.error("Configuration Error: Missing Service Role Key");
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        serviceRoleKey,
        { auth: { persistSession: false } }
      );

      const { error } = await adminClient.auth.admin.createUser({
        email: "admin@vaazhai.com",
        password: "admin123",
        email_confirm: true,
        user_metadata: { role: "admin", full_name: "System Admin" }
      });

      if (error && error.message.includes("already registered")) {
        const { data: userData } = await adminClient.auth.admin.listUsers();
        const existingAdmin = (userData.users as any[]).find(u => u.email === "admin@vaazhai.com");
        if (existingAdmin) {
          await adminClient.from("profiles").upsert({
            user_id: existingAdmin.id,
            full_name: "System Admin",
            username: "admin@vaazhai.com",
            role: "admin",
            department: "Management",
            company: "Vaazhai"
          }, { onConflict: 'user_id' });
        }
        toast.info("Admin system verified.");
      } else if (error) {
        throw error;
      } else {
        toast.success("Admin environment initialized successfully!");
      }
    } catch (err: any) {
      toast.error(err.message || "Environment setup failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background transition-colors duration-700">
      {/* Decorative Animated Background Element */}
      <div className="animated-gradient absolute inset-0 opacity-10 blur-[100px] dark:opacity-20" />
      <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px] animate-pulse dark:bg-emerald-500/20" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px] animate-[bounce_10s_infinite] dark:bg-blue-500/20" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-lg px-4"
      >
        <div className="mb-10 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/50 p-4 backdrop-blur-xl shadow-xl border border-border"
          >
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="font-display text-4xl font-black italic tracking-tighter text-foreground sm:text-5xl uppercase"
          >
            Vaazhai <span className="text-emerald-500">Time Keeper</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-3 text-lg text-muted-foreground font-medium"
          >
            The future of workforce management.
          </motion.p>
        </div>

        <Card className="glass-card overflow-hidden border-border p-1 shadow-2xl bg-card/50 backdrop-blur-xl">
          <div className="bg-gradient-to-br from-background/50 to-transparent p-8 sm:p-10">
            <h2 className="mb-8 text-2xl font-black text-foreground flex items-center gap-2 font-display uppercase italic text-sm tracking-widest">
              {isAdmin && <ShieldAlert className="h-6 w-6 text-red-500" />}
              {isAdmin ? "Admin Portal Access" : "Employee Workspace"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-muted-foreground ml-1 font-bold uppercase text-[10px] tracking-widest">Email / Username</Label>
                <motion.div whileFocus={{ scale: 1.01 }}>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="name@company.com"
                    className="h-12 border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:ring-emerald-500/50 font-bold"
                  />
                </motion.div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground ml-1 font-bold uppercase text-[10px] tracking-widest">Secret Key / Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 border-border bg-background/50 text-foreground placeholder:text-muted-foreground focus:border-emerald-500/50 focus:ring-emerald-500/50 font-bold"
                />
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white h-14 w-full text-lg font-black shadow-lg uppercase tracking-widest transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <LogIn className="h-5 w-5" />
                      Authenticate Access
                    </span>
                  )}
                </Button>
              </motion.div>
            </form>

            <div className="mt-8 flex flex-col items-center gap-4 text-center">
              <button
                onClick={setupAdmin}
                className="text-[10px] font-black text-muted-foreground transition-colors hover:text-emerald-500 uppercase tracking-widest"
              >
                Initialize System Environment
              </button>
            </div>
          </div>
        </Card>

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-red-500/10 p-3 text-[10px] font-black text-red-600 border border-red-500/20 backdrop-blur-sm uppercase tracking-[0.2em]"
          >
            <ShieldAlert className="h-4 w-4" />
            AUTHORIZED PERSONNEL ONLY
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default LoginPage;
