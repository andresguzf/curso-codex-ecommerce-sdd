import { CheckoutAccessGate } from "@/features/checkout/checkout-access-gate";
import { CheckoutReceipt } from "@/features/checkout/checkout-receipt";

export default async function CheckoutReceiptPage({ params }: Readonly<{ params: Promise<{ orderId: string }> }>) {
  const { orderId } = await params;
  return <CheckoutAccessGate><CheckoutReceipt orderId={orderId} /></CheckoutAccessGate>;
}
