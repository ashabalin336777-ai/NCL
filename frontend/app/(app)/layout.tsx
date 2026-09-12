import { AppShell } from "@/components/layout/app-shell";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <AppShell>{children}</AppShell>;
}
