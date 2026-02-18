import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Search, Loader2, Edit, Trash, MoreVertical } from "lucide-react";
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

    const [form, setForm] = useState({
        full_name: "",
        username: "",
        password: "",
        department: "",
        joining_date: "",
        phone_number: "",
        company: "Tensemi", // Default
    });

    const fetchEmployees = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("role", "employee")
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
        setForm({ full_name: "", username: "", password: "", department: "", joining_date: "", phone_number: "", company: "Tensemi" });
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
            username: emp.username.split('@')[0], // Extract username part
            password: "", // Password logic: empty means no change for edit
            department: emp.department || "",
            joining_date: emp.joining_date || "",
            phone_number: emp.phone_number || "",
            company: emp.company || "Tensemi",
        });
        setCurrentId(emp.id);
        setEditMode(true);
        setOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.full_name || !form.department || !form.joining_date) {
            toast.error("Please fill all required fields");
            return;
        }

        if (!editMode && (!form.username || !form.password)) {
            toast.error("Username and password are required for new employees");
            return;
        }

        if (!editMode && form.password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        setSubmitting(true);
        try {
            const action = editMode ? "update-employee" : "create-employee";
            const payload: any = {
                action,
                full_name: form.full_name,
                department: form.department,
                joining_date: form.joining_date,
                company: form.company,
                phone_number: form.phone_number,
            };

            if (editMode) {
                payload.id = currentId;
                // If password provided during edit, we could support password reset here 
                // but currently API update-employee primarily handles metadata.
                // Depending on security requirements, password reset might need separate flow.
            } else {
                payload.username = form.username;
                payload.password = form.password;
            }

            const res = await supabase.functions.invoke("manage-users", {
                body: payload,
            });

            if (res.error) throw res.error;
            if (res.data?.error) throw new Error(res.data.error);

            toast.success(`Employee ${editMode ? "updated" : "created"} successfully!`);
            setOpen(false);
            resetForm();
            fetchEmployees();
        } catch (err: any) {
            toast.error(err.message || `Failed to ${editMode ? "update" : "create"} employee`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        setSubmitting(true); // Reuse submitting state for delete loading
        try {
            const res = await supabase.functions.invoke("manage-users", {
                body: { action: "delete-employee", id: deleteId },
            });

            if (res.error) throw res.error;
            if (res.data?.error) throw new Error(res.data.error);

            toast.success("Employee deleted successfully");
            setDeleteId(null);
            setDeleteOpen(false);
            fetchEmployees();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete employee");
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
        emp.username.toLowerCase().includes(searchTerm.toLowerCase())
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

                                {!editMode && (
                                    <div className="space-y-2">
                                        <Label>Password</Label>
                                        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
                                    </div>
                                )}

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

                                <div className="space-y-2">
                                    <Label>Joining Date</Label>
                                    <Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} />
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
                                    <TableHead>Department</TableHead>
                                    <TableHead>Joining Date</TableHead>
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
                                                <Badge variant="outline">{emp.department}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {emp.joining_date ? format(new Date(emp.joining_date), 'MMM dd, yyyy') : '-'}
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
                                                        <DropdownMenuItem
                                                            onClick={() => confirmDelete(emp.id)}
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
        </div>
    );
};

export default EmployeesPage;
