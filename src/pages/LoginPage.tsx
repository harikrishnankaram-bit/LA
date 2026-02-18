import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Leaf, LogIn, Lock } from "lucide-react";
import { toast } from "sonner";

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
          // Employee trying to access admin login
          toast.error("Access restriction: Employees cannot log in via Admin portal.");
          // Ideally, sign them out or redirect them to employee dashboard
          navigate("/employee", { replace: true });
        } else {
          navigate("/employee", { replace: true });
        }
      }
    }
  }, [user, profile, navigate, isAdmin]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter username and password");
      return;
    }
    setIsLoading(true);
    try {
      await signIn(username.trim(), password);
      // Determine role after login for immediate feedback/redirection checks
      // The useEffect will handle the redirection, but we can do a preliminary check here if we want to be stricter
      toast.success("Logged in successfully");
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const seedAdmin = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "seed-admin" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Admin seeded successfully.");
    } catch (err: any) {
      toast.error("Failed to seed admin: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (

    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Leaf className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Vaazhai Time Keeper
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance & Leave Management
          </p>
        </div>

        <Card className="border shadow-lg">
          <CardHeader className="pb-4 pt-6 text-center">
            <div className="flex justify-center mb-2">
              <LogIn className="h-6 w-6 text-primary" />
            </div>
            <h2 className="font-display text-lg font-semibold">
              Welcome Back
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. john.doe"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" /> Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Hidden Dev Tools triggered by specific action or just keep for now if needed, but styling unified */}
        {isAdmin && (
          <div className="mt-8 text-center space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={seedAdmin}
              disabled={isLoading}
              className="text-xs text-muted-foreground"
            >
              Initialize Admin (Dev)
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
