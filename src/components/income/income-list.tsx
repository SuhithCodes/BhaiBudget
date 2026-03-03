"use client"

import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type Income, type IncomeFormData } from "@/types"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IncomeForm } from "./income-form"

interface IncomeListProps {
    incomes: Income[];
    showTitle?: boolean;
    showExport?: boolean;
    onIncomeDeleted?: (incomeId: string) => Promise<void>;
    onIncomeUpdated?: (incomeId: string, data: IncomeFormData) => Promise<void>;
}

export function IncomeList({
    incomes,
    showTitle = true,
    showExport = false,
    onIncomeDeleted,
    onIncomeUpdated
}: IncomeListProps) {
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);

    const openDeleteDialog = (income: Income) => {
        setSelectedIncome(income);
        setIsDeleteDialogOpen(true);
    };

    const openEditDialog = (income: Income) => {
        setSelectedIncome(income);
        setIsEditDialogOpen(true);
    };

    const handleDelete = async () => {
        if (selectedIncome && onIncomeDeleted) {
            await onIncomeDeleted(selectedIncome.id);
            setIsDeleteDialogOpen(false);
        }
    };

    const handleUpdate = async (data: IncomeFormData) => {
        if (selectedIncome && onIncomeUpdated) {
            await onIncomeUpdated(selectedIncome.id, data);
            setIsEditDialogOpen(false);
        }
    };

    const tableContent = (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12">
                        <span className="sr-only">Actions</span>
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {incomes.length > 0 ? (
                    incomes.map(income => (
                        <TableRow key={income.id}>
                            <TableCell className="font-medium">{income.sourceName}</TableCell>
                            <TableCell className="hidden md:table-cell">{new Date(income.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</TableCell>
                            <TableCell className="text-right">{new Intl.NumberFormat("en-US", { style: "currency", currency: income.currency || 'USD' }).format(income.amount)}</TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => openEditDialog(income)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => openDeleteDialog(income)}>Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No incomes recorded yet.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );

    return (
        <>
            {showTitle ? (
                <Card>
                    <CardHeader className="border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg">Recent Incomes</CardTitle>
                                <CardDescription className="text-xs">A list of your most recent income records.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {tableContent}
                    </CardContent>
                </Card>
            ) : (
                <div className="-mx-4 sm:mx-0">
                    {tableContent}
                </div>
            )}

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the income from {selectedIncome?.sourceName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Income</DialogTitle>
                    </DialogHeader>
                    {selectedIncome && (
                        <IncomeForm
                            onSubmit={handleUpdate}
                            initialData={selectedIncome}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
