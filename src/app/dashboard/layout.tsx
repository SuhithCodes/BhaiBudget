import { Header } from "@/components/layout/header";
import { ProtectedRoute } from "@/context/auth-context";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen w-full flex-col bg-background">
        <Header />
        <DashboardShell>{children}</DashboardShell>
      </div>
    </ProtectedRoute>
  );
}
