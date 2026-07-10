"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useForm, useFieldArray, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, Loader2, UploadCloud, X, PenLine, Clock, Receipt, CreditCard, PlusCircle, Trash2 } from "lucide-react"
import Image from "next/image"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { processReceipt } from "@/lib/actions"
import { cn } from "@/lib/utils"
import { type Expense, type ExpenseFormData, expenseFormSchema, type ProcessedReceiptData } from "@/types"
import { useIsMobile } from "@/hooks/use-mobile";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ExpenseFormProps {
    onSubmit: (expense: ExpenseFormData) => void;
    initialData?: Expense;
}

const DEFAULT_CURRENCY = "USD";

export function ExpenseForm({ onSubmit: onExpenseSubmit, initialData }: ExpenseFormProps) {
    const isMobile = useIsMobile();
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [processedData, setProcessedData] = useState<ProcessedReceiptData | null>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | undefined>(undefined);
    const [showLineItems, setShowLineItems] = useState(false);
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const form = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseFormSchema),
        mode: 'onChange', // Validate on change so isValid is accurate
        defaultValues: initialData || {
            vendorName: "",
            date: format(new Date(), 'yyyy-MM-dd'),
            totalAmount: 0,
            category: "",
            lineItems: [],
            taxes: 0,
            currency: DEFAULT_CURRENCY,
            paymentMethod: "",
            subtotal: 0,
            time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "lineItems",
        keyName: "id", // Use a stable key
    });

    // Use useWatch to avoid re-renders on every keystroke
    const vendorName = useWatch({ control: form.control, name: "vendorName" });
    const category = useWatch({ control: form.control, name: "category" });
    const totalAmount = useWatch({ control: form.control, name: "totalAmount" });

    // Manual total calculation triggered by form submission or specific events
    const calculateTotal = useCallback(() => {
        const lineItems = form.getValues("lineItems") || [];
        const subtotalFromItems = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const subtotal = form.getValues("subtotal") || subtotalFromItems;
        const taxes = form.getValues("taxes") || 0;
        const total = subtotal + taxes;
        form.setValue("totalAmount", parseFloat(total.toFixed(2)), { shouldValidate: false });
        // If subtotal wasn't set, update it from line items
        if (!form.getValues("subtotal") && lineItems.length > 0) {
            form.setValue("subtotal", parseFloat(subtotalFromItems.toFixed(2)), { shouldValidate: false });
        }
    }, [form]);


    useEffect(() => {
        if (initialData) {
            form.reset(initialData);
            // Show line items section if there are existing line items
            if (initialData.lineItems && initialData.lineItems.length > 0) {
                setShowLineItems(true);
            }
            // Calculate total for existing data
            calculateTotal();
        }
    }, [initialData, form, calculateTotal]);

    // Recalculate when line items change
    useEffect(() => {
        const subscription = form.watch((value, { name }) => {
            if (name === 'lineItems' || name?.startsWith('lineItems.')) {
                calculateTotal();
            }
        });
        return () => subscription.unsubscribe();
    }, [form, calculateTotal]);

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach((track) => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    // Cleanup camera on component unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const handleReceiptImage = async (dataURI: string) => {
        if (!dataURI) return;

        resetForm(false);
        setPreviewUrl(dataURI);
        setIsProcessing(true);

        const result = await processReceipt(dataURI);

        if ("error" in result) {
            toast({
                variant: "destructive",
                title: "Processing Failed",
                description: result.error,
            });
            resetForm();
        } else {
            setProcessedData(result);
            // result.date is already validated as YYYY-MM-DD server-side; using
            // it verbatim avoids the local-midnight → UTC day-shift bug.
            const newDate = result.date;
            const lineItems = result.lineItems?.map(item => ({
                name: item.name || '',
                amount: item.amount || 0,
            })) || [];

            // Calculate subtotal from line items if not provided or if it doesn't match
            const subtotalFromItems = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
            const extractedSubtotal = result.subtotal || 0;
            // Use subtotal from line items if available, otherwise use extracted subtotal
            const finalSubtotal = lineItems.length > 0 ? subtotalFromItems : extractedSubtotal;

            form.reset({
                ...result,
                date: newDate,
                lineItems: lineItems,
                subtotal: finalSubtotal,
            });
            calculateTotal();
            // Trigger validation after form is populated
            form.trigger();
        }
        setIsProcessing(false);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            handleReceiptImage(reader.result as string);
        };
        reader.onerror = () => {
            toast({ variant: "destructive", title: "Error", description: "Failed to read file." });
            resetForm();
        }
    };

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");
        context?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        const dataURI = canvas.toDataURL("image/jpeg");
        stopCamera();
        handleReceiptImage(dataURI);
    };

    const startCamera = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setHasCameraPermission(true);
            } catch (error) {
                console.error("Error accessing camera:", error);
                setHasCameraPermission(false);
                toast({
                    variant: "destructive",
                    title: "Camera Access Denied",
                    description: "Please enable camera permissions in your browser settings.",
                });
            }
        } else {
            setHasCameraPermission(false);
            toast({
                variant: "destructive",
                title: "Camera Not Supported",
                description: "Your browser does not support camera access.",
            });
        }
    };

    const handleTabChange = (value: string) => {
        if (value === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }

        if (value === 'manual') {
            resetForm();
            setProcessedData(null);
        }
    };

    const resetForm = (clearFileInput = true) => {
        setIsProcessing(false);
        setPreviewUrl(null);
        setProcessedData(null);
        setShowLineItems(false);
        // Only reset form if we're not editing (no initialData)
        if (!initialData) {
            form.reset({
                vendorName: "",
                date: format(new Date(), 'yyyy-MM-dd'),
                totalAmount: 0,
                category: "",
                lineItems: [],
                taxes: 0,
                currency: DEFAULT_CURRENCY,
                paymentMethod: "",
                subtotal: 0,
                time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            });
        }
        if (clearFileInput && fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        stopCamera();
        setHasCameraPermission(undefined);
    };

    const handleSubmit = (data: ExpenseFormData) => {
        onExpenseSubmit(data);
        if (!initialData) { // Only reset if it's a new expense
            toast({ title: "Expense Saved", description: `${data.vendorName} has been added to your expenses.` });
            resetForm();
        } else { // Editing existing expense
            toast({ title: "Expense Updated", description: `${data.vendorName} has been updated successfully.` });
        }
    };

    // Helper to check if button should be disabled
    const isButtonDisabled = useMemo(() => {
        return form.formState.isSubmitting ||
            !vendorName ||
            !category ||
            !totalAmount ||
            totalAmount <= 0;
    }, [form.formState.isSubmitting, vendorName, category, totalAmount]);

    // Helper to check if a field is incomplete
    const isFieldIncomplete = useCallback((fieldName: 'vendorName' | 'category' | 'totalAmount') => {
        if (form.formState.isSubmitting) return false;
        let value: string | number | undefined;
        if (fieldName === 'vendorName') value = vendorName;
        else if (fieldName === 'category') value = category;
        else value = totalAmount;

        if (fieldName === 'totalAmount') {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
            return !value || numValue <= 0;
        }
        return !value;
    }, [form.formState.isSubmitting, vendorName, category, totalAmount]);

    const vendorNameIncomplete = isFieldIncomplete('vendorName');
    const categoryIncomplete = isFieldIncomplete('category');
    const totalAmountIncomplete = isFieldIncomplete('totalAmount');

    const expenseFieldsContent = (
        <div className="space-y-4 animate-in fade-in duration-500">
            {previewUrl && (
                <div className="relative w-full h-32 sm:h-40 rounded-lg overflow-hidden border bg-muted/20">
                    <Image src={previewUrl} alt="Receipt preview" layout="fill" objectFit="contain" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 rounded-full shadow-md" onClick={() => resetForm()}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear form</span>
                    </Button>
                </div>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="vendorName">Vendor Name *</Label>
                    <Input
                        id="vendorName"
                        {...form.register("vendorName")}
                        placeholder="Enter vendor name"
                        className={cn(
                            vendorNameIncomplete && isButtonDisabled && "border-destructive focus-visible:ring-destructive"
                        )}
                    />
                    {form.formState.errors.vendorName && (
                        <p className="text-sm text-destructive">{form.formState.errors.vendorName.message}</p>
                    )}
                    {vendorNameIncomplete && isButtonDisabled && !form.formState.errors.vendorName && (
                        <p className="text-sm text-destructive">Vendor name is required</p>
                    )}
                </div>
                <div className="space-y-1.5">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Category *</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className={cn(
                                            categoryIncomplete && isButtonDisabled && "border-destructive focus-visible:ring-destructive"
                                        )}>
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {EXPENSE_CATEGORIES.map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                {categoryIncomplete && isButtonDisabled && !form.formState.errors.category && (
                                    <p className="text-sm text-destructive">Category is required</p>
                                )}
                            </FormItem>
                        )}
                    />
                </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="date">Date *</Label>
                    <div className="relative">
                        <Input
                            id="date"
                            type="date"
                            {...form.register("date")}
                        />
                        {form.formState.errors.date && (
                            <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>
                        )}
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="time">Time</Label>
                    <div className="relative">
                        <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="time"
                            type="time"
                            className="pl-9"
                            {...form.register("time")}
                        />
                    </div>
                </div>
            </div>

            {/* Amount Details */}
            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="subtotal">Subtotal</Label>
                    <div className="relative">
                        <Receipt className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="subtotal"
                            type="number"
                            step="0.01"
                            className="pl-9"
                            {...form.register("subtotal", { valueAsNumber: true })}
                            placeholder="0.00"
                            onBlur={calculateTotal}
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="taxes">Tax</Label>
                    <Input
                        id="taxes"
                        type="number"
                        step="0.01"
                        {...form.register("taxes", { valueAsNumber: true })}
                        placeholder="0.00"
                        onBlur={calculateTotal}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="totalAmount">Total Amount *</Label>
                    <div className="relative">
                        <Input
                            id="totalAmount"
                            type="number"
                            step="0.01"
                            {...form.register("totalAmount", { valueAsNumber: true })}
                            placeholder="0.00"
                            readOnly={true}
                            className={cn(
                                totalAmountIncomplete && isButtonDisabled && "border-destructive focus-visible:ring-destructive"
                            )}
                        />
                        <p className="text-xs text-muted-foreground mt-1">subtotal + tax</p>
                        {form.formState.errors.totalAmount && (
                            <p className="text-sm text-destructive">{form.formState.errors.totalAmount.message}</p>
                        )}
                        {totalAmountIncomplete && isButtonDisabled && !form.formState.errors.totalAmount && (
                            <p className="text-sm text-destructive">Total amount must be greater than 0</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Line Items */}
            {showLineItems && (
                <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">Line Items</h3>
                            <p className="text-sm text-muted-foreground">Add individual items from your receipt.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '', amount: 0 })}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Item
                        </Button>
                    </div>

                    {fields.length > 0 && (
                        <div className="space-y-3">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                                    <Input
                                        {...form.register(`lineItems.${index}.name`)}
                                        placeholder="Item name"
                                    />
                                    <Input
                                        type="number"
                                        step="0.01"
                                        {...form.register(`lineItems.${index}.amount`, { valueAsNumber: true })}
                                        placeholder="Amount"
                                        className="w-28"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    {fields.length === 0 && (
                        <div className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-muted bg-muted/50 p-6 text-center">
                            <p className="text-sm text-muted-foreground">No line items added yet.</p>
                            <p className="mt-1 text-xs text-muted-foreground">The total amount is calculated automatically from subtotal + tax.</p>
                        </div>
                    )}
                </div>
            )}


            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                        id="currency"
                        {...form.register("currency")}
                        placeholder="USD"
                        maxLength={3}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <div className="relative">
                        <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="paymentMethod"
                            className="pl-9"
                            {...form.register("paymentMethod")}
                            placeholder="e.g., Credit Card"
                        />
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLineItems(!showLineItems)}
                >
                    Items
                </Button>
                <Button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isButtonDisabled}
                >
                    {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {initialData ? 'Update Expense' : 'Save Expense'}
                </Button>
            </div>
        </div>
    );

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <Tabs defaultValue="upload" className="w-full" onValueChange={handleTabChange}>
                    <TabsList className={cn("grid w-full", isMobile ? "grid-cols-2" : "grid-cols-3")}>
                        <TabsTrigger value="upload" className="text-sm">Upload File</TabsTrigger>
                        {!isMobile && <TabsTrigger value="camera" className="text-sm">Scan Receipt</TabsTrigger>}
                        <TabsTrigger value="manual" className="text-sm">Manual Entry</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload">
                        {!processedData ? (
                            <div className="relative mt-4">
                                <Label htmlFor="receipt-upload" className={cn(
                                    "flex flex-col items-center justify-center w-full h-48 sm:h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                                    isProcessing && "cursor-wait bg-muted/50"
                                )}>
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin text-primary" />
                                            <p className="mt-4 text-sm text-muted-foreground">Analyzing your receipt...</p>
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground" />
                                            <p className="mt-4 text-sm text-muted-foreground">
                                                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                                            </p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG or PDF</p>
                                        </>
                                    )}
                                </Label>
                                <Input ref={fileInputRef} id="receipt-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" disabled={isProcessing} />
                            </div>
                        ) : (
                            expenseFieldsContent
                        )}
                    </TabsContent>

                    {!isMobile && (
                        <TabsContent value="camera">
                            {!processedData ? (
                                <div className="mt-4 space-y-4">
                                    <div className="w-full bg-muted rounded-lg overflow-hidden flex items-center justify-center aspect-video">
                                        <video ref={videoRef} className={cn("w-full h-full object-cover", { 'hidden': hasCameraPermission !== true })} autoPlay muted playsInline />
                                        {hasCameraPermission === false && (
                                            <div className="p-4">
                                                <Alert variant="destructive">
                                                    <AlertTitle>Camera Access Required</AlertTitle>
                                                    <AlertDescription>
                                                        Please allow camera access in your browser to use this feature. You may need to refresh the page.
                                                    </AlertDescription>
                                                </Alert>
                                            </div>
                                        )}
                                        {hasCameraPermission === undefined && !isProcessing && (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                                <p className="text-muted-foreground">Requesting camera...</p>
                                            </div>
                                        )}
                                    </div>
                                    <Button type="button" className="w-full" onClick={handleCapture} disabled={!hasCameraPermission || isProcessing}>
                                        <Camera className="mr-2 h-4 w-4" />
                                        {isProcessing ? 'Capturing...' : 'Capture Photo'}
                                    </Button>
                                    <canvas ref={canvasRef} className="hidden"></canvas>
                                </div>
                            ) : (
                                expenseFieldsContent
                            )}
                        </TabsContent>
                    )}

                    <TabsContent value="manual">
                        <div className="mt-4">
                            {expenseFieldsContent}
                        </div>
                    </TabsContent>
                </Tabs>
            </form>
        </Form>
    );
}
