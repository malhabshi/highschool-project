import { AuthGuard } from "@/components/auth-guard";
import { RoleProvider } from "@/components/role-context";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <RoleProvider>
        <AppShell>{children}</AppShell>
      </RoleProvider>
    </AuthGuard>
  );
}
