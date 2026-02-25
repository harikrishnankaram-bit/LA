import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Search, Loader2, Edit, Trash, MoreVertical, Key, Users, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const EmployeesPage = () => {
    // State for fetching employees
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // State for adding/editing employee
    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Deletion state
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    // Password Reset state
    const [resetEmp, setResetEmp] = useState<any>(null);
    const [resetOpen, setResetOpen] = useState(false);

    const [form, setForm] = useState({
        full_name: "",
        username: "",
        department: "",
        phone_number: "",
        company: "Vaazhai",
    });



    const fetchEmployees = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .neq("role", "admin")
            .order("created_at", { ascending: false });


        if (!error && data) {
            setEmployees(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const resetForm = () => {
        setForm({ full_name: "", username: "", department: "", phone_number: "", company: "Vaazhai" });


        setEditMode(false);
        setCurrentId(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setOpen(true);
    };

    const handleOpenEdit = (emp: any) => {
        setForm({
            full_name: emp.full_name,
            username: emp.username, // Keep full email
            department: emp.department || "",
            phone_number: emp.phone_number || "",
            company: emp.company || "Vaazhai",
        });


        setCurrentId(emp.user_id);
        setEditMode(true);
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.full_name || !form.department) {
            toast.error("Please fill all required fields");
            return;
        }

        if (!editMode && !form.username) {
            toast.error("Mail ID is required");
            return;
        }

        setSubmitting(true);
        try {
            if (editMode && currentId) {
                // UPDATE EXISTING EMPLOYEE
                const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
                if (!serviceRoleKey) {
                    throw new Error("Missing VITE_SUPABASE_SERVICE_ROLE_KEY in .env file");
                }
                const { createClient } = await import('@supabase/supabase-js');
                const adminClient = createClient(import.meta.env.VITE_SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false } });

                // 1. Update Auth Metadata (so identity is consistent)
                await adminClient.auth.admin.updateUserById(currentId, {
                    user_metadata: {
                        full_name: form.full_name,
                        department: form.department,
                        company: form.company,
                        phone_number: form.phone_number,
                    }
                });

                // 2. Update Profiles table
                const { error: profileError } = await adminClient
                    .from("profiles")
                    .update({
                        full_name: form.full_name,
                        department: form.department,
                        company: form.company,
                        phone_number: form.phone_number,
                    })
                    .eq("user_id", currentId);

                if (profileError) throw profileError;
                toast.success("Employee updated successfully!");

            } else {
                // CREATE NEW EMPLOYEE
                const companyPart = form.company ? form.company.replace(/\s+/g, '') : "Vaazhai";
                let last4 = form.phone_number ? form.phone_number.replace(/\D/g, '').slice(-4) : "";
                if (last4.length < 4) last4 = "1234";
                const generatedPassword = `${companyPart}@${last4}`;

                // Using service role key directly in frontend to bypass "signups disabled"
                const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
                if (!serviceRoleKey) {
                    throw new Error("Missing VITE_SUPABASE_SERVICE_ROLE_KEY in .env file");
                }

                const { createClient } = await import('@supabase/supabase-js');
                const adminClient = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    serviceRoleKey,
                    { auth: { persistSession: false } }
                );

                const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                    email: form.username,
                    password: generatedPassword,
                    email_confirm: true,
                    user_metadata: {
                        full_name: form.full_name,
                        username: form.username,
                        role: "employee",
                        department: form.department,
                        company: form.company,
                        phone_number: form.phone_number,
                    }
                });

                if (authError) throw authError;

                // SMALL DELAY + MANUAL FALLBACK
                // Wait 500ms for the DB trigger to finish, then forcefully sync the profile
                // just in case the trigger failed or missed some columns.
                await new Promise(resolve => setTimeout(resolve, 500));

                if (authData.user) {
                    const { error: syncError } = await adminClient.from("profiles").upsert({
                        user_id: authData.user.id,
                        full_name: form.full_name,
                        username: form.username,
                        department: form.department,
                        company: form.company,
                        phone_number: form.phone_number,
                        role: "employee"
                    }, { onConflict: 'user_id' });

                    if (syncError) console.error("Manual profile sync failed:", syncError);
                }

                toast.success(`Account created! Default Password: ${generatedPassword}`, { duration: 8000 });
            }

            setOpen(false);

            resetForm();
            fetchEmployees();
        } catch (err: any) {
            toast.error(err.message || "Operation failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setSubmitting(true);
        try {
            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceRoleKey) {
                throw new Error("Missing VITE_SUPABASE_SERVICE_ROLE_KEY in .env file");
            }

            const { createClient } = await import('@supabase/supabase-js');
            const adminClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                serviceRoleKey,
                { auth: { persistSession: false } }
            );

            // 1. Delete Attendance Data
            await adminClient.from("attendance_daily").delete().eq("user_id", deleteId);

            // 2. Delete Leaves
            await adminClient.from("leaves").delete().eq("user_id", deleteId);

            // 3. Delete Notifications
            await adminClient.from("notifications").delete().eq("user_id", deleteId);

            // 4. Delete Profile using admin client (bypasses RLS)
            const { error: profileError } = await adminClient
                .from("profiles")
                .delete()
                .eq("user_id", deleteId);

            if (profileError) throw profileError;

            // 5. Delete Auth User
            const { error: authError } = await adminClient.auth.admin.deleteUser(deleteId);
            if (authError) {
                console.error("Auth deletion warning:", authError);
                // We continue if it's already gone or if there's a soft error
            }

            toast.success("Employee removed successfully");
            setDeleteId(null);
            setDeleteOpen(false);
            fetchEmployees();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete");
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetPassword = (emp: any) => {
        setResetEmp(emp);
        setResetOpen(true);
    };

    const confirmResetPassword = async () => {
        if (!resetEmp) return;
        const emp = resetEmp;
        let companyPart = emp.company ? emp.company.replace(/\s+/g, '') : "Vaazhai";
        let last4 = emp.phone_number ? emp.phone_number.replace(/\D/g, '').slice(-4) : "";
        if (last4.length < 4) last4 = "1234";
        let newPassword = `${companyPart}@${last4}`;

        setSubmitting(true);
        try {
            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceRoleKey) throw new Error("Missing service role key");

            const { createClient } = await import('@supabase/supabase-js');
            const adminClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                serviceRoleKey,
                { auth: { persistSession: false } }
            );

            const { error } = await adminClient.auth.admin.updateUserById(emp.user_id, {
                password: newPassword
            });

            if (error) throw error;
            toast.success(`Password reset to: ${newPassword}`, { duration: 8000 });
            setResetOpen(false);
            setResetEmp(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to reset password");
        } finally {
            setSubmitting(false);
        }
    };

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json: any[] = XLSX.utils.sheet_to_json(sheet);

            if (json.length === 0) {
                toast.error("Excel file is empty");
                setUploading(false);
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
            if (!serviceRoleKey) {
                throw new Error("Missing VITE_SUPABASE_SERVICE_ROLE_KEY in .env file");
            }

            const { createClient } = await import('@supabase/supabase-js');
            const adminClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                serviceRoleKey,
                { auth: { persistSession: false } }
            );

            for (const row of json) {
                const fullName = row["Full Name"];
                const mailID = row["Mail ID"];
                const phoneNumber = row["Phone Number"]?.toString() || "";
                const company = row["Company"] || "Vaazhai";
                const department = row["Department"];

                if (!fullName || !mailID || !department) {
                    errorCount++;
                    continue;
                }

                const companyPart = company.replace(/\s+/g, '');
                let last4 = phoneNumber.replace(/\D/g, '').slice(-4);
                if (last4.length < 4) last4 = "1234";
                const generatedPassword = `${companyPart}@${last4}`;

                // Check if user exists first to prevent duplicate email error
                const { data: existRes } = await adminClient.from("profiles").select("user_id").eq("username", mailID).maybeSingle();
                if (existRes) {
                    errorCount++;
                    continue; // Skip existing user for simplicity
                }

                const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
                    email: mailID,
                    password: generatedPassword,
                    email_confirm: true,
                    user_metadata: {
                        full_name: fullName,
                        username: mailID,
                        role: "employee",
                        department: department,
                        company: company,
                        phone_number: phoneNumber,
                    }
                });

                if (authError) {
                    console.error("Error creating user:", mailID, authError);
                    errorCount++;
                    continue;
                }

                // Wait for db triggers
                await new Promise(resolve => setTimeout(resolve, 500));

                if (authData.user) {
                    const { error: syncError } = await adminClient.from("profiles").upsert({
                        user_id: authData.user.id,
                        full_name: fullName,
                        username: mailID,
                        department: department,
                        company: company,
                        phone_number: phoneNumber,
                        role: "employee"
                    }, { onConflict: 'user_id' });

                    if (syncError) {
                        console.error("Manual profile sync failed:", syncError);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                }
            }

            if (successCount > 0) {
                toast.success(`Successfully uploaded ${successCount} employees.`);
            }
            if (errorCount > 0) {
                toast.error(`Failed to upload ${errorCount} employees (missing fields or duplicates).`);
            }

            fetchEmployees();
        } catch (error: any) {
            toast.error(error.message || "Failed to parse Excel file");
            console.error(error);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };


    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setDeleteOpen(true);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="page-header text-foreground mb-0">Employees</h1>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleExcelUpload}
                            disabled={uploading}
                        />
                        <Button disabled={uploading} className="bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/20 transition-all duration-300">
                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload Excel
                        </Button>
                    </div>

                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleOpenAdd} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-300">
                                <UserPlus className="mr-2 h-4 w-4" /> Add Employee
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] glass-card border-border bg-card/90 backdrop-blur-2xl">
                            <DialogHeader>
                                <DialogTitle className="font-display font-black uppercase italic tracking-widest text-foreground">{editMode ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                                <DialogDescription className="text-muted-foreground font-medium">
                                    {editMode ? "Update employee details." : "Create a new employee account."}
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                                <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                                        <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" maxLength={100} className="bg-background border-border text-foreground font-bold rounded-xl" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mail ID (Username)</Label>
                                        <Input
                                            type="email"
                                            value={form.username}
                                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                                            placeholder="john@tensemi.com"
                                            disabled={editMode}
                                            className="bg-background border-border text-foreground font-bold rounded-xl disabled:opacity-50"
                                        />
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight ml-1">This will be used for login.</p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                                        <Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+91 9876543210" className="bg-background border-border text-foreground font-bold rounded-xl" />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company</Label>
                                        <Select
                                            value={form.company}
                                            onValueChange={(value) => setForm({ ...form, company: value })}
                                        >
                                            <SelectTrigger className="bg-background border-border text-foreground font-bold rounded-xl">
                                                <SelectValue placeholder="Select company" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-popover border-border text-popover-foreground">
                                                <SelectItem value="Vaazhai">Vaazhai (Core)</SelectItem>
                                                <SelectItem value="Tensemi">Tensemi</SelectItem>
                                                <SelectItem value="Aram">Aram</SelectItem>
                                                <SelectItem value="Raphael Creatives">Raphael Creatives</SelectItem>
                                                <SelectItem value="Kottravai">Kottravai</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Department</Label>
                                        <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" maxLength={50} className="bg-background border-border text-foreground font-bold rounded-xl" />
                                    </div>

                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={submitting} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest h-12 rounded-xl transition-all duration-300">
                                        {submitting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            editMode ? <Edit className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />
                                        )}
                                        {editMode ? "Update details" : "Create Account"}
                                    </Button>
                                </DialogFooter>

                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="glass-card border-border shadow-sm overflow-hidden bg-card/50 backdrop-blur-lg">
                <CardHeader className="bg-secondary/30 border-b border-border py-6 px-8 flex flex-row items-center justify-between gap-4 flex-wrap">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.3em] text-foreground flex items-center gap-2">
                        <Users className="h-4 w-4 text-emerald-500" />
                        Employee Registry
                    </CardTitle>
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search employees..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-10 bg-background border-border text-foreground font-bold rounded-xl"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-secondary/20">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6 pl-8">Employee Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6">Email</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6">Department</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6">Phone Number</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6">Status</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-foreground/70 py-6 pr-8 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-500" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4 animate-pulse">Loading Employees</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-64 text-center">
                                            <Users size={48} className="mx-auto text-muted-foreground opacity-20" />
                                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-4">No active records found.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <TableRow key={emp.id} className="border-border hover:bg-secondary/10 transition-colors">
                                            <TableCell className="py-6 pl-8">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 flex items-center justify-center text-emerald-600 font-black text-sm border border-emerald-500/20 shadow-sm">
                                                        {emp.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-black text-foreground tracking-tight uppercase leading-none">{emp.full_name}</p>
                                                        <div className="mt-1.5">
                                                            <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[9px] font-black bg-emerald-500/10 text-emerald-600 border-none uppercase tracking-widest">
                                                                <img
                                                                    src={`/${emp.company || "Vaazhai"}.png`}
                                                                    alt=""
                                                                    className="h-3 w-3 object-contain"
                                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                                />
                                                                {emp.company || "Vaazhai"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[11px] font-mono text-muted-foreground font-bold">{emp.username}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-secondary text-[10px] font-black text-muted-foreground border border-border uppercase tracking-widest">
                                                    {emp.department || "No Dept"}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-[11px] font-mono font-bold text-foreground">{emp.phone_number || '-'}</TableCell>
                                            <TableCell>
                                                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-none font-black text-[9px] uppercase tracking-widest">Active</Badge>
                                            </TableCell>

                                            <TableCell className="text-right pr-8">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-card border-border shadow-xl rounded-xl p-1">
                                                        <DropdownMenuItem onClick={() => handleOpenEdit(emp)} className="rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 p-2.5 focus:bg-secondary">
                                                            <Edit className="h-4 w-4 text-emerald-500" />
                                                            Edit Profile
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleResetPassword(emp)} className="rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 p-2.5 focus:bg-secondary">
                                                            <Key className="h-4 w-4 text-blue-500" />
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => confirmDelete(emp.user_id)}
                                                            className="rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 p-2.5 text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent className="glass-card border-border bg-card/90 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-display font-black uppercase text-foreground">Confirm Delete?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium">
                            This action cannot be undone. This will permanently delete the employee account and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl border-border bg-transparent text-foreground font-black uppercase tracking-widest hover:bg-secondary">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDelete();
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-600/20"
                            disabled={submitting}
                        >
                            {submitting ? "Processing..." : "Confirm Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent className="glass-card border-border bg-card/90 backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-display font-black uppercase text-foreground">Reset Password?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground font-medium">
                            Are you sure you want to reset the password for <strong>{resetEmp?.full_name}</strong>?
                            The new password will be auto-generated based on their company and phone number.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel onClick={() => setResetEmp(null)} className="rounded-xl border-border bg-transparent text-foreground font-black uppercase tracking-widest hover:bg-secondary">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmResetPassword();
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20"
                            disabled={submitting}
                        >
                            {submitting ? "Resetting..." : "Confirm Reset"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default EmployeesPage;
