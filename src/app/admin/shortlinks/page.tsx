"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Shortlinks are managed inside 用户管理 */
export default function AdminShortlinksRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/users");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
      短链接已合并到用户管理，正在跳转…
    </div>
  );
}
