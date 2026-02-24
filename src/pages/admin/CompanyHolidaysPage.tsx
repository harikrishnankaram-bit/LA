import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash, Plus, Loader2, Calendar, Globe, Building2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";

export default function CompanyHolidaysPage() {
    const [holidays, setHolidays] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        name: "",
        date: "",
        company: "all", // "all" means global
    });

    const fetchHolidays = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("company_holidays")
            .select("*")
            .order("date", { ascending: true });

        if (!error && data) {
            setHolidays(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchHolidays();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name || !form.date) {
            toast.error("Please provide a name and date for the holiday.");
            return;
        }

        setSubmitting(true);
        try {
            const companyValue = form.company === "all" ? null : form.company;

            const { error } = await supabase
                .from("company_holidays")
                .insert([{
                    name: form.name,
                    date: form.date,
                    company: companyValue
                }]);

            if (error) {
                if (error.code === '23505') {
                    throw new Error("A holiday for this company already exists on this date.");
                }
                throw error;
            }

            toast.success("Protocol: Holiday record synchronized!");
            setForm({ name: "", date: "", company: "all" });
            fetchHolidays();
        } catch (err: any) {
            toast.error(err.message || "Failed to add holiday");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { error } = await supabase
                .from("company_holidays")
                .delete()
                .eq("id", id);

            if (error) throw error;
            toast.success("Holiday record purged");
            fetchHolidays();
        } catch (err: any) {
            toast.error("Failed to delete holiday");
        }
    };

    return (
        <div className="space-y-10 pb-20">
            <div className="flex flex-col gap-1">
                <h1 className="page-header text-4xl font-black italic tracking-tighter text-foreground uppercase">
                    Company <span className="text-emerald-500">Holidays</span>
                </h1>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.4em] ml-1">Observance & Protocol Management</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Add Holiday Form */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-1"
                >
                    <Card className="glass-card border-border shadow-2xl bg-card/50 backdrop-blur-xl sticky top-8">
                        <CardHeader className="bg-secondary/30 border-b border-border/50 px-6 py-4">
                            <CardTitle className="text-[10px] font-black tracking-[0.2em] uppercase text-foreground flex items-center gap-2">
                                <Plus size={14} className="text-emerald-500" />
                                Synchronize New Holiday
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Holiday Designation</Label>
                                    <Input
                                        placeholder="e.g. Lunar Sequence, Solar Shift"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-emerald-500/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Transmission Date</Label>
                                    <Input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm({ ...form, date: e.target.value })}
                                        className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-emerald-500/50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Unit Deployment (Scope)</Label>
                                    <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
                                        <SelectTrigger className="h-12 bg-background border-border rounded-xl text-foreground font-bold focus:ring-emerald-500/50">
                                            <SelectValue placeholder="Select company scope" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-popover border-border">
                                            <SelectItem value="all" className="font-bold">Global Observance (All Units)</SelectItem>
                                            <SelectItem value="Tensemi" className="font-bold">Tensemi</SelectItem>
                                            <SelectItem value="Aram" className="font-bold">Aram</SelectItem>
                                            <SelectItem value="Raphael Creatives" className="font-bold">Raphael Creatives</SelectItem>
                                            <SelectItem value="Kottravai" className="font-bold">Kottravai</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/10 uppercase tracking-widest border-none transition-all"
                                >
                                    {submitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Plus className="h-5 w-5 mr-2" />}
                                    Deploy Holiday Protocol
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Holiday List */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-2"
                >
                    <Card className="glass-card border-border shadow-2xl bg-card/30 backdrop-blur-lg overflow-hidden">
                        <CardHeader className="bg-secondary/30 border-b border-border/50 px-8 py-6">
                            <CardTitle className="text-[10px] font-black tracking-[0.4em] uppercase text-foreground flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-emerald-500" />
                                Workforce Observance Archive
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center p-24">
                                    <Loader2 className="h-12 w-12 animate-spin text-emerald-500/50" />
                                </div>
                            ) : holidays.length === 0 ? (
                                <div className="text-center py-24 text-muted-foreground flex flex-col items-center gap-4 opacity-30">
                                    <ShieldAlert size={48} />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground">No observances detected in system core</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    <AnimatePresence>
                                        {holidays.map((holiday, idx) => (
                                            <motion.div
                                                key={holiday.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="flex items-center justify-between p-6 px-8 hover:bg-secondary/20 transition-all group"
                                            >
                                                <div className="flex items-center gap-6">
                                                    <div className="flex flex-col items-center justify-center bg-emerald-500/10 text-emerald-500 w-16 h-16 rounded-2xl border border-emerald-500/20 shadow-inner shrink-0 group-hover:scale-105 transition-transform duration-300">
                                                        <span className="text-[10px] font-black uppercase tracking-tighter">{format(new Date(holiday.date), 'MMM')}</span>
                                                        <span className="text-2xl font-black italic tracking-tighter leading-none">{format(new Date(holiday.date), 'dd')}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-foreground italic uppercase tracking-tighter leading-tight">{holiday.name}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            {holiday.company ? (
                                                                <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                                                    <Building2 size={10} /> {holiday.company} Unit
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                                                    <Globe size={10} /> Global Protocol
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] font-mono font-bold text-muted-foreground opacity-50 ml-2">ID: {holiday.id.split('-')[0]}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-12 w-12 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                                                        >
                                                            <Trash className="h-5 w-5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-card border-border bg-card/90 backdrop-blur-2xl rounded-3xl">
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-foreground">Purge Observance?</AlertDialogTitle>
                                                            <AlertDialogDescription className="text-muted-foreground font-medium">
                                                                This will permanently delete the holiday protocol for <span className="text-foreground font-bold italic">"{holiday.name}"</span>. This action is irreversible.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter className="mt-6 gap-3">
                                                            <AlertDialogCancel className="h-12 rounded-xl bg-background border-border text-foreground font-black uppercase text-[10px] tracking-widest hover:bg-secondary">Cancel</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => handleDelete(holiday.id)}
                                                                className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest border-none px-8"
                                                            >
                                                                Purge Record
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
}
