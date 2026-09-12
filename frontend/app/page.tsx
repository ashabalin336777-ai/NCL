import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE } from "@/lib/auth-constants";

export default function HomePage(): never {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  redirect(token ? "/dashboard" : "/login");
}
