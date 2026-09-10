import { OrderDetailPage } from "@/features/orders/order-detail";

export default async function MyOrderPage({ params }: Readonly<{ params: Promise<{ orderId: string }> }>) {
  const { orderId } = await params;
  return <OrderDetailPage orderId={orderId} />;
}
