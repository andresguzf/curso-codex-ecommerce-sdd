import { ProductDetail } from "../../../features/catalog/product-detail";

export default async function ProductDetailPage({
  params,
}: Readonly<{
  params: Promise<{ productId: string }>;
}>) {
  const { productId } = await params;

  return <ProductDetail productId={productId} />;
}
