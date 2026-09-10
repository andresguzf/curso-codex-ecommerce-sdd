import { AdministrativeOrderDetailPage } from "@/features/orders/order-detail";

export default async function OrderDetailPage({ params }: Readonly<{ params: Promise<{ orderId: string }> }>) {
  const { orderId } = await params;
  return <AdministrativeOrderDetailPage orderId={orderId} />;
}
