import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, ShieldAlert, Sparkles, Fingerprint, Lock, Mail, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (user && profile) {
      if (profile.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (profile.role === "employee") {
        if (isAdmin) {
          toast.error("Restriction: Employees cannot access the Controller Portal.");
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
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="h-16 w-16 rounded-3xl border-4 border-emerald-500 border-t-transparent shadow-xl relative z-10"
          />
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Security Alert: Missing credentials.");
      return;
    }
    setIsLoading(true);
    try {
      await signIn(username.trim(), password);
      toast.success("Authentication Successful", {
        description: `Logged in as ${isAdmin ? "Administrator" : "Employee"}.`,
        icon: <Sparkles className="h-4 w-4 text-emerald-500" />
      });
    } catch (err: any) {
      toast.error(err.message || "Authentication breakdown: Access Denied");
    } finally {
      setIsLoading(false);
    }
  };

  const setupAdmin = async () => {
    setIsLoading(true);
    try {
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        toast.error("Config Failure: Missing Service Role Authority");
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
        toast.info("Security Audit: Admin account synchronization verified.");
      } else if (error) {
        throw error;
      } else {
        toast.success("Environmental Initialization: Core administrator deployed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Initialization failure");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background">
      {/* Dynamic Ambient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className={`absolute top-[-10%] left-[-10%] h-[60%] w-[60%] rounded-full blur-[120px] opacity-10 ${isAdmin ? 'bg-red-500' : 'bg-emerald-500'}`}
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className={`absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full blur-[100px] opacity-10 ${isAdmin ? 'bg-amber-500' : 'bg-blue-600'}`}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", damping: 15, stiffness: 100 }}
          className="mb-12 text-center"
        >
          <div className="relative inline-block mb-6">
            <div className={`absolute inset-0 blur-2xl rounded-full opacity-20 ${isAdmin ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <motion.div
              whileHover={{ rotate: 5 }}
              className="relative h-28 w-28 rounded-[2.5rem] bg-card/40 backdrop-blur-2xl border border-white/20 p-5 shadow-2xl flex items-center justify-center"
            >
              <img src="/logo.png" alt="Vaazhai" className="h-full w-full object-contain filter drop-shadow-lg" onError={(e) => e.currentTarget.style.display = 'none'} />
              <Fingerprint className={`h-12 w-12 ${isAdmin ? 'text-red-500' : 'text-emerald-500'}`} />
            </motion.div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-foreground uppercase leading-tight">
            VAAZHAI <span className={isAdmin ? 'text-red-500' : 'text-emerald-500'}>CHRONOS</span>
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.6em] text-muted-foreground ml-2">
            Temporal Operations Interface
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-full"
        >
          <Card className="glass-card border-border/50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] bg-card/60 backdrop-blur-3xl overflow-hidden rounded-[2rem]">
            <CardContent className="p-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Access Terminal</h2>
                  <p className="text-lg font-black italic uppercase tracking-tight text-foreground">
                    {isAdmin ? "Controller Node" : "Personnel Uplink"}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center border transition-colors ${isAdmin ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                  {isAdmin ? <ShieldAlert /> : <Lock />}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="username" className="text-[10px] font-black uppercase tracking-widest text-foreground/60 ml-1">Identity Vector (Email)</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 group-focus-within:text-emerald-500 transition-colors" />
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="identity@vaazhai.net"
                      className="h-14 pl-12 bg-background/50 border-border rounded-2xl text-foreground font-bold focus:ring-emerald-500/30 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-foreground/60 ml-1">Verification Code (Password)</Label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40 group-focus-within:text-emerald-500 transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 pl-12 bg-background/50 border-border rounded-2xl text-foreground font-bold focus:ring-emerald-500/30 transition-all text-sm"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-16 rounded-2xl text-white font-black uppercase tracking-[0.2em] shadow-2xl transition-all duration-500 border-none ${isAdmin
                    ? 'bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 shadow-red-500/20'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/20'
                    }`}
                >
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <span className="flex items-center justify-center gap-3">
                      Authenticate Access <LogIn className="h-5 w-5" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-10 flex flex-col items-center">
                <div className="h-px w-10 bg-border/50 mb-6" />
                <button
                  type="button"
                  onClick={setupAdmin}
                  className="text-[9px] font-bold text-muted-foreground hover:text-emerald-500 transition-colors uppercase tracking-[0.4em] text-center px-4"
                >
                  Initialize System Core
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md"
          >
            <ShieldAlert className="h-4 w-4 text-red-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Secure Controller Node</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
