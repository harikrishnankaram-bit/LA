import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Search, Loader2, Edit, Trash, MoreVertical, Key } from "lucide-react";
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
                const { createClient } = await import('@supabase/supabase-js');
                const adminClient = createClient(import.meta.env.VITE_SUPABASE_URL, serviceRoleKey!, { auth: { persistSession: false } });

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
            // Note: Direct deletion of Auth users from frontend is not allowed for security with ANON key.
            // But we can use the service role key if we really want to delete the auth user too.
            const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

            if (serviceRoleKey) {
                const { createClient } = await import('@supabase/supabase-js');
                const adminClient = createClient(
                    import.meta.env.VITE_SUPABASE_URL,
                    serviceRoleKey,
                    { auth: { persistSession: false } }
                );
                await adminClient.auth.admin.deleteUser(deleteId);
            }

            const { error: profileError } = await supabase
                .from("profiles")
                .delete()
                .eq("user_id", deleteId);

            if (profileError) throw profileError;

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


    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setDeleteOpen(true);
    };

    const filteredEmployees = employees.filter(emp =>
        emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.phone_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="page-header mb-0">Employees</h1>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleOpenAdd}>
                            <UserPlus className="mr-2 h-4 w-4" /> Add Employee
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>{editMode ? "Edit Employee" : "Add New Employee"}</DialogTitle>
                            <DialogDescription>
                                {editMode ? "Update employee details." : "Create a new employee account."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Doe" maxLength={100} />
                                </div>

                                <div className="space-y-2">
                                    <Label>Mail ID (Username)</Label>
                                    <Input
                                        type="email"
                                        value={form.username}
                                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                                        placeholder="john@tensemi.com"
                                        disabled={editMode}
                                    />
                                    <p className="text-[0.8rem] text-muted-foreground">This will be used for login.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Phone Number</Label>
                                    <Input type="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} placeholder="+91 9876543210" />
                                </div>

                                <div className="space-y-2">
                                    <Label>Company</Label>
                                    <Select
                                        value={form.company}
                                        onValueChange={(value) => setForm({ ...form, company: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select company" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Tensemi">Tensemi</SelectItem>
                                            <SelectItem value="Aram">Aram</SelectItem>
                                            <SelectItem value="Raphael Creatives">Raphael Creatives</SelectItem>
                                            <SelectItem value="Kottravai">Kottravai</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Department</Label>
                                    <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Engineering" maxLength={50} />
                                </div>

                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={submitting} className="w-full">
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

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-medium">All Employees</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Phone Number</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>

                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredEmployees.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No employees found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <TableRow key={emp.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                        {emp.full_name.charAt(0)}
                                                    </div>
                                                    {emp.full_name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{emp.username}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="gap-1 px-1.5 py-1">
                                                    <img
                                                        src={`/${emp.company || "Vaazhai"}.png`}
                                                        alt=""
                                                        className="h-4 w-4 object-contain"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                    {emp.company || "Vaazhai"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{emp.department}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">{emp.phone_number || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={emp.role === 'admin' ? "default" : "outline"}>
                                                    {emp.role || 'employee'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
                                            </TableCell>

                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleOpenEdit(emp)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleResetPassword(emp)}>
                                                            <Key className="mr-2 h-4 w-4" />
                                                            Reset Password
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => confirmDelete(emp.user_id)}
                                                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" />
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the employee account and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={submitting}
                        >
                            {submitting ? "Deleting..." : "Delete Employee"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Password?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to reset the password for <strong>{resetEmp?.full_name}</strong>?
                            The new password will be auto-generated based on their company and phone number.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setResetEmp(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmResetPassword}
                            className="bg-primary text-white"
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
