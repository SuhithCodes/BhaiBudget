"use client"

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { type Income, type IncomeFormData, incomeFormSchema } from "@/types";
import { INCOME_SOURCES } from "@/lib/constants";

interface IncomeFormProps {
  onSubmit: (income: IncomeFormData) => void;
  initialData?: Income;
}

const DEFAULT_CURRENCY = "USD";

export function IncomeForm({ onSubmit, initialData }: IncomeFormProps) {
  const { toast } = useToast();

  const form = useForm<IncomeFormData>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: initialData || {
      sourceName: "",
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      currency: DEFAULT_CURRENCY,
      note: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  const handleSubmit = (data: IncomeFormData) => {
    onSubmit(data);
    if (!initialData) {
      toast({ title: "Income Saved", description: `${data.sourceName} has been added.` });
      form.reset({
        sourceName: "",
        date: new Date().toISOString().split("T")[0],
        amount: 0,
        currency: DEFAULT_CURRENCY,
        note: "",
      });
    } else {
      toast({ title: "Income Updated", description: `${data.sourceName} has been updated.` });
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit(handleSubmit)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Source</Label>
          <Select
            onValueChange={(value) => form.setValue('sourceName', value, { shouldValidate: true })}
            value={form.watch('sourceName')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {INCOME_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.sourceName && (
            <p className="text-sm text-destructive">{form.formState.errors.sourceName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...form.register("date")} />
          {form.formState.errors.date && (
            <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          {form.formState.errors.amount && (
            <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" placeholder="USD" {...form.register("currency")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input id="note" placeholder="Optional notes" {...form.register("note")} />
      </div>

      <div className="pt-2 flex justify-end">
        <Button type="submit">Save Income</Button>
      </div>
    </form>
  );
}
