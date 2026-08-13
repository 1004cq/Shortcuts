import { redirect } from "next/navigation";

/** Membership pricing removed — redirect to play-times recharge */
export default function PricingRedirectPage() {
  redirect("/recharge");
}
