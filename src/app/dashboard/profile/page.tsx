'use client';

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { useState, useEffect, useRef } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { getExpenses, deleteAllExpenses } from '@/lib/actions/expenses';
import { deleteAllIncomes } from '@/lib/actions/incomes';
import { saveAs } from 'file-saver';
import { endOfMonth, startOfMonth, format as formatDate, subMonths, startOfYear, endOfYear, subDays, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter } from 'date-fns';
import { generateReport, type ReportData } from '@/ai/flows/generate-monthly-report';
import { ReportPreview } from '@/components/report/report-preview';
import { Loader2, FileText, Download, FileSpreadsheet, Sparkles, Mail, Send, Bell, BellRing } from 'lucide-react';
import { requestNotificationPermission, getNotificationPermission } from '@/lib/push-notifications';
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
} from "@/components/ui/alert-dialog";

interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  monthlyReports: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<UserPreferences>({
    emailNotifications: false,
    pushNotifications: false,
    monthlyReports: false,
  });
  const [reportStartDate, setReportStartDate] = useState(
    formatDate(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [reportEndDate, setReportEndDate] = useState(
    formatDate(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  useEffect(() => {
    if (user) {
      const prefDocRef = doc(db, 'userPreferences', user.uid);
      getDoc(prefDocRef).then((docSnap) => {
        if (docSnap.exists()) {
          setPreferences(docSnap.data() as UserPreferences);
        }
      });
    }
  }, [user]);

  const handlePreferenceChange = async (key: keyof UserPreferences, value: boolean) => {
    if (!user) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const prefDocRef = doc(db, 'userPreferences', user.uid);
      await setDoc(prefDocRef, newPreferences, { merge: true });
      toast({ title: 'Preferences Updated' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save preferences.' });
    }
  };

  const handleSendTestEmail = async () => {
    if (!user?.email) {
      toast({ variant: 'destructive', title: 'Error', description: 'No email address found.' });
      return;
    }
    setSendingTestEmail(true);
    try {
      const res = await fetch('/api/notifications/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Test Email Sent!', description: `Check your inbox at ${user.email}` });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send test email. Check SMTP settings.' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'Please allow notifications in your browser settings.' });
        return;
      }
    }
    handlePreferenceChange('pushNotifications', value);
  };

  const handleMonthlyReportsToggle = async (value: boolean) => {
    if (value && user?.email) {
      const prefDocRef = doc(db, 'userPreferences', user.uid);
      await setDoc(prefDocRef, { monthlyReports: value, email: user.email }, { merge: true });
      setPreferences((prev) => ({ ...prev, monthlyReports: value }));
      toast({ title: 'Monthly Reports Enabled', description: `Reports will be sent to ${user.email} on the 1st of each month.` });
    } else {
      handlePreferenceChange('monthlyReports', value);
    }
  };

  const handleExportExpensesCSV = async () => {
    if (!user) return;
    const allExpenses = await getExpenses(user.uid);
    const expenses = allExpenses.filter(
      (e) => e.date >= reportStartDate && e.date <= reportEndDate
    );
    if (expenses.length === 0) {
      toast({ title: 'No Data', description: 'No expenses found in the selected date range.', variant: 'destructive' });
      return;
    }
    const headers = [
      'id', 'vendorName', 'date', 'time', 'totalAmount', 'currency',
      'category', 'subtotal', 'taxes', 'paymentMethod', 'lineItems', 'confidence'
    ];
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '';
      let str = String(value);
      if (Array.isArray(value)) {
        str = value.join('; ');
      }
      if (str.search(/("|,|\n)/g) >= 0) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvRows = [headers.join(',')];
    for (const expense of expenses) {
      const values = headers.map(header => {
        const key = header as keyof typeof expense;
        return escapeCSV(expense[key]);
      });
      csvRows.push(values.join(','));
    }
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'expenses.csv');
    toast({ title: 'Export Successful', description: 'Your expenses have been downloaded as a CSV file.' });
  };

  const handleSummaryReport = async () => {
    if (!user) return;
    setIsGeneratingReport(true);
    setReportData(null);
    try {
      const data = await generateReport(user.uid, reportStartDate, reportEndDate);
      setReportData(data);
      toast({ title: 'Report Generated', description: 'Your AI financial summary is ready.' });
    } catch (error) {
      console.error('Report generation failed:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not generate report.' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloadingPDF(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `YABA-Report-${reportStartDate}-to-${reportEndDate}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }).from(reportRef.current).save();
      toast({ title: 'PDF Downloaded' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not download PDF.' });
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const setDatePreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case 'thisMonth':
        setReportStartDate(formatDate(startOfMonth(now), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'lastMonth':
        const lm = subMonths(now, 1);
        setReportStartDate(formatDate(startOfMonth(lm), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(endOfMonth(lm), 'yyyy-MM-dd'));
        break;
      case 'thisQuarter':
        setReportStartDate(formatDate(startOfQuarter(now), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(endOfQuarter(now), 'yyyy-MM-dd'));
        break;
      case 'thisYear':
        setReportStartDate(formatDate(startOfYear(now), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(endOfYear(now), 'yyyy-MM-dd'));
        break;
      case 'last7Days':
        setReportStartDate(formatDate(subDays(now, 6), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(now, 'yyyy-MM-dd'));
        break;
      case 'last30Days':
        setReportStartDate(formatDate(subDays(now, 29), 'yyyy-MM-dd'));
        setReportEndDate(formatDate(now, 'yyyy-MM-dd'));
        break;
    }
  };

  const handleClearExpenses = async () => {
    if (!user) return;
    const result = await deleteAllExpenses(user.uid);
    if (result.success) {
      toast({ title: 'Success', description: 'All expenses have been cleared.' });
      window.location.reload();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const handleClearAllData = async () => {
    if (!user) return;
    const [expensesResult, incomesResult] = await Promise.all([
      deleteAllExpenses(user.uid),
      deleteAllIncomes(user.uid)
    ]);

    if (expensesResult.success && incomesResult.success) {
      toast({ title: 'Success', description: 'All financial data has been cleared.' });
      window.location.reload();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not clear all data.' });
    }
  };

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <main className="flex flex-1 flex-col gap-6 px-0 py-4 sm:px-4 md:gap-8 md:p-8 w-full max-w-screen-2xl">
      {/* Page header with avatar */}
      <div className="flex items-center gap-4 px-4 sm:px-0">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white text-lg font-semibold shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="font-headline text-2xl font-semibold tracking-tight">{user?.displayName || 'Your Account'}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <div className="px-4 sm:px-0">
          <TabsList className="w-full max-w-lg grid grid-cols-4 mb-4">
            <TabsTrigger value="profile">Account</TabsTrigger>
            <TabsTrigger value="password">Security</TabsTrigger>
            <TabsTrigger value="notifications">Alerts</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Account ────────────────────────────────────────── */}
        <TabsContent value="profile">
          <Card className="border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Account Details</CardTitle>
              <CardDescription>Your personal information tied to this account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Full Name</Label>
                  <Input id="name" defaultValue={user?.displayName || ''} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Email Address</Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled className="opacity-60" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button size="sm">Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── Security ───────────────────────────────────────── */}
        <TabsContent value="password">
          <Card className="border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Security</CardTitle>
              <CardDescription>Update your password. Use a strong, unique password you don't use elsewhere.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confirm Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button size="sm">Update Password</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ── Notifications ──────────────────────────────────── */}
        <TabsContent value="notifications">
          <Card className="border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Notification Preferences</CardTitle>
              <CardDescription>Configure how and when YABA communicates with you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Email Notifications */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-violet-500/10">
                      <Mail className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">Email Alerts</p>
                      <p className="text-xs text-muted-foreground mt-1">Budget warnings and spending alerts via email</p>
                    </div>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={preferences.emailNotifications}
                    onCheckedChange={(value) => handlePreferenceChange('emailNotifications', value)}
                  />
                </div>
                {preferences.emailNotifications && (
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
                    <p className="text-xs text-muted-foreground">
                      Delivering to <span className="font-medium text-foreground">{user?.email}</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSendTestEmail}
                      disabled={sendingTestEmail}
                    >
                      {sendingTestEmail ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Sending</>
                      ) : (
                        <><Send className="mr-1.5 h-3 w-3" />Verify</>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Push Notifications */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10">
                      <Bell className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">Push Notifications</p>
                      <p className="text-xs text-muted-foreground mt-1">Real-time browser alerts for transactions and budget limits</p>
                    </div>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={preferences.pushNotifications}
                    onCheckedChange={handlePushToggle}
                  />
                </div>
                {preferences.pushNotifications && (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <p className="text-xs text-muted-foreground">
                      {typeof window !== 'undefined' && 'Notification' in window
                        ? Notification.permission === 'granted'
                          ? 'Permission granted — notifications active'
                          : Notification.permission === 'denied'
                            ? 'Permission blocked — update in browser settings'
                            : 'Awaiting permission'
                        : 'Not supported in this browser'}
                    </p>
                  </div>
                )}
              </div>

              {/* Monthly Reports */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10">
                      <FileText className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">Monthly Summary</p>
                      <p className="text-xs text-muted-foreground mt-1">AI-generated financial report delivered on the 1st of each month</p>
                    </div>
                  </div>
                  <Switch
                    id="monthly-reports"
                    checked={preferences.monthlyReports}
                    onCheckedChange={handleMonthlyReportsToggle}
                  />
                </div>
                {preferences.monthlyReports && (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <p className="text-xs text-muted-foreground">
                      Scheduled for <span className="font-medium text-foreground">{user?.email}</span> — 1st of every month, 9:00 AM UTC
                    </p>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data & Reports ─────────────────────────────────── */}
        <TabsContent value="data">
          <Card className="border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Data & Reports</CardTitle>
              <CardDescription>Select a date range, then export your data or generate an AI-powered summary.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Date range */}
              <div className="rounded-lg border p-4 space-y-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date Range</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="report-start" className="text-xs text-muted-foreground">From</Label>
                    <Input id="report-start" type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="report-end" className="text-xs text-muted-foreground">To</Label>
                    <Input id="report-end" type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['This Month', 'thisMonth'],
                    ['Last Month', 'lastMonth'],
                    ['7 Days', 'last7Days'],
                    ['30 Days', 'last30Days'],
                    ['Quarter', 'thisQuarter'],
                    ['Year', 'thisYear'],
                  ].map(([label, key]) => (
                    <Button key={key} variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={() => setDatePreset(key)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={handleExportExpensesCSV} className="justify-center">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={handleSummaryReport} disabled={isGeneratingReport} className="justify-center">
                  {isGeneratingReport ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />AI Summary Report</>
                  )}
                </Button>
              </div>

              {/* Report Preview */}
              {reportData && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={isDownloadingPDF}>
                      {isDownloadingPDF ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing...</>
                      ) : (
                        <><Download className="mr-2 h-4 w-4" />Download PDF</>
                      )}
                    </Button>
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    <ReportPreview ref={reportRef} data={reportData} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="mt-6 border-destructive/40 border-x-0 sm:border-x rounded-none sm:rounded-xl shadow-none sm:shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
                <div>
                  <p className="text-sm font-medium">Clear Expenses</p>
                  <p className="text-xs text-muted-foreground">Permanently delete all expense records</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Clear</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all expenses?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action is permanent and cannot be reversed. All expense records will be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearExpenses}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
                <div>
                  <p className="text-sm font-medium">Clear All Data</p>
                  <p className="text-xs text-muted-foreground">Permanently delete all expenses and income records</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">Clear All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete all financial data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action is permanent and cannot be reversed. All expense and income records will be deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAllData}>Delete Everything</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </main>
  )
}
