"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Check, X, Volume2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { processVoiceTransaction, type VoiceTransactionResult, type ParsedTransaction } from "@/ai/flows/parse-voice-transaction";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import { checkBudgetAlerts } from "@/lib/check-budget-alerts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type AgentState = "idle" | "recording" | "processing" | "confirming" | "no-result";

interface VoiceTransactionAgentProps {
    onStateChange?: (state: AgentState) => void;
    onMicClickRef?: React.MutableRefObject<(() => void) | null>;
}

export function VoiceTransactionAgent({ onStateChange, onMicClickRef }: VoiceTransactionAgentProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [state, _setState] = useState<AgentState>("idle");
    const setState = (newState: AgentState) => {
        _setState(newState);
        onStateChange?.(newState);
    };
    const [result, setResult] = useState<VoiceTransactionResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const startRecording = useCallback(async () => {
        setError(null);
        setResult(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                ? "audio/webm;codecs=opus"
                : MediaRecorder.isTypeSupported("audio/webm")
                    ? "audio/webm"
                    : "audio/mp4";

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;

                const audioBlob = new Blob(chunksRef.current, { type: mimeType });

                if (audioBlob.size < 1000) {
                    setError("Recording too short. Please try again.");
                    setState("idle");
                    return;
                }

                setState("processing");

                try {
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const base64 = Buffer.from(arrayBuffer).toString("base64");
                    // Pass the client's local calendar date so "today"/"yesterday"
                    // resolve in the user's timezone, not the server's UTC.
                    const voiceResult = await processVoiceTransaction(base64, mimeType, format(new Date(), "yyyy-MM-dd"));

                    if (voiceResult.transactions.length === 0) {
                        setResult(voiceResult);
                        setState("no-result");
                    } else {
                        setResult(voiceResult);
                        setState("confirming");
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Something went wrong.";
                    setError(message);
                    setState("idle");
                }
            };

            mediaRecorder.start(250);
            setState("recording");

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        } catch {
            setError("Microphone access denied. Please allow microphone access in your browser settings.");
            setState("idle");
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
            if (navigator.vibrate) {
                navigator.vibrate([30, 30, 30]);
            }
        }
    }, []);

    const handleConfirm = async () => {
        if (!user || !result || result.transactions.length === 0) return;

        try {
            setState("processing");
            let expenseCount = 0;
            let incomeCount = 0;
            const expenseCategories = new Set<string>();

            for (const tx of result.transactions) {
                if (tx.type === "expense" && tx.expense) {
                    await addDoc(collection(db, "expenses"), {
                        ...tx.expense,
                        userId: user.uid,
                        currency: "USD",
                    });
                    expenseCategories.add(tx.expense.category);
                    expenseCount++;
                } else if (tx.type === "income" && tx.income) {
                    await addDoc(collection(db, "incomes"), {
                        ...tx.income,
                        userId: user.uid,
                        currency: "USD",
                    });
                    incomeCount++;
                }
            }

            // Check budget alerts for every affected category (fire-and-forget)
            for (const category of expenseCategories) {
                checkBudgetAlerts(user.uid, category).catch(() => { });
            }

            const parts: string[] = [];
            if (expenseCount > 0) parts.push(`${expenseCount} expense${expenseCount > 1 ? "s" : ""}`);
            if (incomeCount > 0) parts.push(`${incomeCount} income${incomeCount > 1 ? "s" : ""}`);

            toast({
                title: "Saved via Voice 🎤",
                description: `Added ${parts.join(" and ")}.`,
            });

            setResult(null);
            setState("idle");
        } catch {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not save the transaction(s).",
            });
            setState("confirming");
        }
    };

    const handleCancel = () => {
        setResult(null);
        setError(null);
        setState("idle");
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    };

    const handleMicClick = useCallback(() => {
        if (state === "recording") {
            stopRecording();
        } else if (state === "idle" || state === "no-result") {
            startRecording();
        }
    }, [state, stopRecording, startRecording]);

    // Expose handleMicClick to parent via ref
    if (onMicClickRef) {
        onMicClickRef.current = handleMicClick;
    }

    const renderTransaction = (tx: ParsedTransaction, index: number) => {
        if (tx.type === "expense" && tx.expense) {
            return (
                <div key={index} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-red-600 dark:text-red-400">Expense</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">
                            ${tx.expense.totalAmount.toFixed(2)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-muted-foreground text-xs">Vendor</span>
                            <p className="font-medium">{tx.expense.vendorName}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Category</span>
                            <p className="font-medium">{tx.expense.category}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Date</span>
                            <p className="font-medium">{tx.expense.date}</p>
                        </div>
                    </div>
                </div>
            );
        }
        if (tx.type === "income" && tx.income) {
            return (
                <div key={index} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">Income</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            ${tx.income.amount.toFixed(2)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-muted-foreground text-xs">Source</span>
                            <p className="font-medium">{tx.income.sourceName}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground text-xs">Date</span>
                            <p className="font-medium">{tx.income.date}</p>
                        </div>
                        {tx.income.note && (
                            <div className="col-span-2">
                                <span className="text-muted-foreground text-xs">Note</span>
                                <p className="font-medium">{tx.income.note}</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <>
            {/* Confirmation Card with multiple transactions */}
            {state === "confirming" && result && result.transactions.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50" onClick={handleCancel} />
                    <Card className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300 max-h-[80vh] flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <Volume2 className="h-5 w-5 text-primary" />
                                {result.transactions.length === 1
                                    ? "Transaction Detected"
                                    : `${result.transactions.length} Transactions Detected`}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground italic">
                                &ldquo;{result.transcript}&rdquo;
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3 overflow-y-auto">
                            {result.transactions.map((tx, i) => renderTransaction(tx, i))}
                        </CardContent>
                        <CardFooter className="flex gap-2 pt-3 border-t">
                            <Button variant="outline" className="flex-1" onClick={handleCancel}>
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleConfirm}>
                                <Check className="mr-2 h-4 w-4" />
                                Confirm {result.transactions.length > 1 ? "All" : ""}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* No transaction detected */}
            {state === "no-result" && result && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50" onClick={handleCancel} />
                    <Card className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom-4 duration-300">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg text-amber-600 dark:text-amber-400">
                                <AlertCircle className="h-5 w-5" />
                                No Transaction Detected
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground italic">
                                You said: &ldquo;{result.transcript}&rdquo;
                            </p>
                            <p className="text-sm">
                                I couldn&apos;t identify any expenses or income in your statement. Try being specific, for example:
                            </p>
                            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                                <li>&ldquo;I spent twenty dollars at Starbucks&rdquo;</li>
                                <li>&ldquo;Received three thousand from salary&rdquo;</li>
                                <li>&ldquo;Paid fifty for gas and thirty for groceries&rdquo;</li>
                            </ul>
                        </CardContent>
                        <CardFooter className="flex gap-2 pt-0">
                            <Button variant="outline" className="flex-1" onClick={handleCancel}>
                                Dismiss
                            </Button>
                            <Button className="flex-1" onClick={() => { handleCancel(); setTimeout(startRecording, 300); }}>
                                <Mic className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {/* Error toast */}
            {error && state === "idle" && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border-destructive bg-destructive/10">
                        <CardContent className="flex items-center gap-3 py-3 px-4">
                            <p className="text-sm text-destructive font-medium">{error}</p>
                            <Button variant="ghost" size="sm" onClick={() => setError(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Processing indicator */}
            {state === "processing" && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in">
                    <Card className="shadow-lg">
                        <CardContent className="flex items-center gap-3 py-3 px-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <p className="text-sm font-medium">Processing your voice...</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Floating Mic Button */}
            <Button
                onClick={handleMicClick}
                disabled={state === "processing" || state === "confirming"}
                size="icon"
                className={cn(
                    "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-xl transition-all hidden md:flex",
                    "hover:scale-105 active:scale-95",
                    "ring-2 ring-white/20",
                    state === "recording"
                        ? "bg-red-600 hover:bg-red-700 animate-pulse"
                        : "bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600",
                    (state === "processing" || state === "confirming") && "opacity-50 cursor-not-allowed"
                )}
                aria-label={state === "recording" ? "Stop recording" : "Start voice transaction"}
            >
                {state === "recording" ? (
                    <MicOff className="h-6 w-6 text-white" />
                ) : state === "processing" ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                    <Mic className="h-6 w-6 text-white" />
                )}
            </Button>

            {/* Recording indicator label */}
            {state === "recording" && (
                <div className="fixed bottom-[88px] right-6 z-40 animate-in fade-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 shadow-lg">
                        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                        <span className="text-xs font-medium text-white">
                            Listening... Tap to stop
                        </span>
                    </div>
                </div>
            )}
        </>
    );
}
