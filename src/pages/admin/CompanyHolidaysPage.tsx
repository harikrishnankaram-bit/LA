import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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

            toast.success("Holiday added successfully!");
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
            toast.success("Holiday deleted");
            fetchHolidays();
        } catch (err: any) {
            toast.error("Failed to delete holiday");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4">
                <h1 className="page-header mb-0">Company Holidays</h1>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Add Holiday Form */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Holiday</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Holiday Name</Label>
                                <Input
                                    placeholder="e.g. Diwali, Christmas"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Applies To</Label>
                                <Select value={form.company} onValueChange={(v) => setForm({ ...form, company: v })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select company scope" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Companies (Global)</SelectItem>
                                        <SelectItem value="Tensemi">Tensemi</SelectItem>
                                        <SelectItem value="Aram">Aram</SelectItem>
                                        <SelectItem value="Raphael Creatives">Raphael Creatives</SelectItem>
                                        <SelectItem value="Kottravai">Kottravai</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="submit" disabled={submitting} className="w-full">
                                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Add Holiday
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Holiday List */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : holidays.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                                No holidays configured yet.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {holidays.map(holiday => (
                                    <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-center justify-center bg-primary/10 text-primary w-12 h-12 rounded-md">
                                                <span className="text-xs font-bold uppercase">{format(new Date(holiday.date), 'MMM')}</span>
                                                <span className="text-lg font-bold leading-none">{format(new Date(holiday.date), 'dd')}</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-foreground">{holiday.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {holiday.company ? `Only for ${holiday.company}` : 'Global Holiday (All Companies)'}
                                                </p>
                                            </div>
                                        </div>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the holiday "{holiday.name}".
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(holiday.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
