"use client"

import { useState } from "react"
import { MoreHorizontal, FileDown, Pencil, Trash2 } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { type Expense, type ExpenseFormData } from "@/types"
import { CategoryIcon } from "@/components/expenses/category-icon"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ExpenseForm } from "./expense-form"
import { Badge } from "@/components/ui/badge"

interface ExpenseListProps {
    expenses: Expense[];
    showTitle?: boolean;
    showExport?: boolean;
    onExpenseDeleted?: (expenseId: string) => Promise<void>;
    onExpenseUpdated?: (expenseId: string, data: ExpenseFormData) => Promise<void>;
}

export function ExpenseList({
    expenses,
    showTitle = true,
    showExport = false,
    onExpenseDeleted,
    onExpenseUpdated
}: ExpenseListProps) {
    const { toast } = useToast();
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

    const openDeleteDialog = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsDeleteDialogOpen(true);
    };

    const openEditDialog = (expense: Expense) => {
        setSelectedExpense(expense);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async () => {
        if (selectedExpense && onExpenseDeleted) {
            await onExpenseDeleted(selectedExpense.id);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleUpdate = async (data: ExpenseFormData) => {
        if (selectedExpense && onExpenseUpdated) {
            await onExpenseUpdated(selectedExpense.id, data);
            setIsEditDialogOpen(false);
        }
    };

    return (
        <>
            <Card>
                {showTitle && (
                    <CardHeader className="border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Recent Expenses</CardTitle>
                                <CardDescription className="text-xs">Your most recent spending activity.</CardDescription>
                            </div>
                            {showExport && expenses.length > 0 && (
                                <Button variant="outline" size="sm" className="h-8 text-xs">
                                    <FileDown className="mr-2 h-3.5 w-3.5" />
                                    Export
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                )}
                <CardContent className="pt-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                                <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Vendor</TableHead>
                                <TableHead className="py-3 text-xs font-semibold uppercase tracking-wider">Category</TableHead>
                                <TableHead className="hidden md:table-cell py-3 text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                                <TableHead className="text-right py-3 text-xs font-semibold uppercase tracking-wider">Amount</TableHead>
                                <TableHead className="w-10">
                                    <span className="sr-only">Actions</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.length > 0 ? (
                                expenses.map(expense => (
                                    <TableRow key={expense.id} className="group transition-colors">
                                        <TableCell className="font-medium max-w-[150px] whitespace-normal break-words py-3">{expense.vendorName}</TableCell>
                                        <TableCell className="py-3">
                                            <Badge variant="outline" className="font-normal text-[10px] bg-primary/5 border-primary/20 text-primary uppercase tracking-tight px-1.5 py-0">
                                                {expense.category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm py-3">
                                            {new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold py-3">
                                            {new Intl.NumberFormat("en-US", { style: "currency", currency: expense.currency || 'USD' }).format(expense.totalAmount)}
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                        <span className="sr-only">Toggle menu</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem className="text-sm cursor-pointer" onSelect={() => openEditDialog(expense)}>
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-sm cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50" onSelect={() => openDeleteDialog(expense)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-sm italic">
                                        No expenses recorded for this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>


            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the expense for {selectedExpense?.vendorName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Edit Expense Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Expense</DialogTitle>
                    </DialogHeader>
                    {selectedExpense && (
                        <ExpenseForm
                            onSubmit={handleUpdate}
                            initialData={selectedExpense}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
