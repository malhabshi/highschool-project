import { RoleProvider } from "@/components/role-context";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleProvider>
      <AppShell>{children}</AppShell>
    </RoleProvider>
  );
}
