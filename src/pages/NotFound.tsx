import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Home, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error at:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[60%] w-[60%] rounded-full bg-red-500/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md text-center"
      >
        <div className="mb-8 flex justify-center">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            onClick={() => window.history.back()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest h-14 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center"
          >
            Go Back
          </motion.div>
        </div>

        <h1 className="text-8xl font-black italic tracking-tighter text-foreground uppercase leading-none mb-2">
          404
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-red-500 mb-8 ml-2">
          Coordinate Not Found
        </p>

        <div className="max-w-md w-full glass-card border-border/50 shadow-2xl p-8 rounded-[2rem] text-center relative z-10 mb-10">
          <h2 className="text-xl font-black uppercase tracking-widest text-foreground mb-4">Page Not Found</h2>
          <p className="text-sm font-bold text-muted-foreground mb-8 text-balance">
            The requested page <span className="font-mono text-emerald-500 font-bold bg-secondary/50 px-2 py-0.5 rounded">{location.pathname}</span> does not exist.
          </p>
        </div>

        <Link to="/">
          <Button className="h-14 px-8 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-black uppercase tracking-widest transition-all shadow-xl group">
            <ChevronLeft className="mr-2 h-5 w-5 group-hover:-translate-x-1 transition-transform" />
            Return to Command Center
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
