import type { UserRole } from "@/types/api";

export function roleLabel(role: UserRole | string): string {
  if (role === "developer") return "Разработчик";
  if (role === "admin") return "РОП";
  return "Менеджер";
}

export function isDeveloper(role: UserRole | string | undefined): boolean {
  return role === "developer";
}

export function isRop(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "developer";
}

export function isStaff(role: UserRole | string | undefined): boolean {
  return role === "admin" || role === "developer";
}
