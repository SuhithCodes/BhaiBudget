"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  Settings,
  Mic,
} from 'lucide-react';

interface MobileNavProps {
  onMicClick?: () => void;
  micState?: 'idle' | 'recording' | 'processing' | 'confirming' | 'no-result';
}

export function MobileNav({ onMicClick, micState = 'idle' }: MobileNavProps) {
  const pathname = usePathname();

  const leftItems = [
    {
      href: '/dashboard',
      icon: LayoutDashboard,
      label: 'Home',
      active: pathname === '/dashboard'
    },
    {
      href: '/dashboard/transactions',
      icon: ReceiptText,
      label: 'Transactions',
      active: pathname === '/dashboard/transactions'
    },
  ];

  const rightItems = [
    {
      href: '/dashboard/budgets',
      icon: PiggyBank,
      label: 'Budgets',
      active: pathname === '/dashboard/budgets'
    },
    {
      href: '/dashboard/profile',
      icon: Settings,
      label: 'Settings',
      active: pathname === '/dashboard/profile'
    }
  ];

  const renderItem = (item: typeof leftItems[0]) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center justify-center transition-all duration-200",
          item.active
            ? "bg-primary text-primary-foreground shadow-md rounded-full px-3 py-2"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full w-10 h-10"
        )}
      >
        <Icon className="h-5 w-5" />
        {item.active && (
          <span className="text-xs font-medium ml-2 whitespace-nowrap">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const isRecording = micState === 'recording';
  const isBusy = micState === 'processing' || micState === 'confirming';

  return (
    <div className="md:hidden fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="relative bg-background/80 backdrop-blur-sm border rounded-full px-2 py-2 shadow-lg">
        <nav className="flex items-center space-x-1">
          {leftItems.map(renderItem)}

          {/* Center mic button — inline within the pill */}
          <button
            onClick={onMicClick}
            disabled={isBusy}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition-all",
              "hover:scale-105 active:scale-95",
              isRecording
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600",
              isBusy && "opacity-50 cursor-not-allowed"
            )}
            aria-label={isRecording ? "Stop recording" : "Start voice transaction"}
          >
            <Mic className="h-5 w-5 text-white" />
          </button>

          {rightItems.map(renderItem)}
        </nav>
      </div>
    </div>
  );
} 