import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Home, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("PROTOCOL BREACH: 404 Error at coordinate:", location.pathname);
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
            transition={{ duration: 4, repeat: Infinity }}
            className="h-24 w-24 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-2xl shadow-red-500/10"
          >
            <ShieldAlert size={48} />
          </motion.div>
        </div>

        <h1 className="text-8xl font-black italic tracking-tighter text-foreground uppercase leading-none mb-2">
          404
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-red-500 mb-8 ml-2">
          Coordinate Not Found
        </p>

        <div className="glass-card border-border/50 p-8 rounded-[2rem] bg-card/60 backdrop-blur-3xl shadow-2xl mb-10">
          <p className="text-lg font-bold text-foreground mb-2 italic uppercase tracking-tight">System Exception</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The requested spatial coordinate <span className="font-mono text-red-500 font-bold bg-secondary/50 px-2 py-0.5 rounded">{location.pathname}</span> does not exist in the Vaazhai Chronos registry.
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
