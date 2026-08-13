import { redirect } from "next/navigation";

export default function PricingResultRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string") qs.set(k, v);
    }
  }
  const q = qs.toString();
  redirect(q ? `/recharge/result?${q}` : "/recharge/result");
}
