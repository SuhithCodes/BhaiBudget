'use client';

import { CircleUser, Loader2, LogOut, ReceiptText, Settings, Target, LayoutDashboard, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [incomeTotal, setIncomeTotal] = useState<number>(0);
  const [expenseTotal, setExpenseTotal] = useState<number>(0);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    if (!user) {
      setIncomeTotal(0);
      setExpenseTotal(0);
      return;
    }
    const incomesQuery = query(collection(db, 'incomes'), where('userId', '==', user.uid));
    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', user.uid));

    const unsubIncome = onSnapshot(incomesQuery, (snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as { amount?: number };
        total += Number(data.amount || 0);
      });
      setIncomeTotal(total);
    });

    const unsubExpense = onSnapshot(expensesQuery, (snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => {
        const data = doc.data() as { totalAmount?: number };
        total += Number(data.totalAmount || 0);
      });
      setExpenseTotal(total);
    });

    return () => {
      unsubIncome();
      unsubExpense();
    };
  }, [user]);

  const balance = useMemo(() => incomeTotal - expenseTotal, [incomeTotal, expenseTotal]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/dashboard" className="mr-4 flex items-center">
          <img src="/logo.svg" alt="YABA Logo" className="h-8 w-8" />
          <span className="ml-3 font-bold font-headline text-xl">YABA</span>
        </Link>
        <div className="ml-2 hidden sm:flex items-center">
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 bg-background/60">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Current Balance</span>
            <span className={`text-sm font-semibold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(balance)}</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end sm:space-x-2">
          <div className="sm:hidden font-semibold text-sm pr-2">{formatCurrency(balance)}</div>
          <ThemeToggle />
          <nav className="flex items-center space-x-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full flex-shrink-0">
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CircleUser className="h-5 w-5" />
                  )}
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {loading ? (
                  <DropdownMenuLabel>Loading...</DropdownMenuLabel>
                ) : user ? (
                  <>
                    <DropdownMenuLabel>
                      <p className="font-medium">My Account</p>
                      <p className="text-xs text-muted-foreground font-normal truncate">
                        {user.email}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/transactions">
                        <ReceiptText className="mr-2 h-4 w-4" />
                        <span>Transactions</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/budgets">
                        <Target className="mr-2 h-4 w-4" />
                        <span>Budgets & Goals</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/profile">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/">Login</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/signup">Sign Up</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>
    </header>
  );
}
