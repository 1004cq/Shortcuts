import { redirect } from "next/navigation";

/** Shortlink admin was merged into /admin/users */
export default function AdminShortlinksRedirectPage() {
  redirect("/admin/users");
}
