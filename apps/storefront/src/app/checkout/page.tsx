import { CheckoutAccessGate } from "@/features/checkout/checkout-access-gate";
import { CheckoutForm } from "@/features/checkout/checkout-form";

export default function CheckoutPage() {
  return <CheckoutAccessGate><CheckoutForm /></CheckoutAccessGate>;
}
