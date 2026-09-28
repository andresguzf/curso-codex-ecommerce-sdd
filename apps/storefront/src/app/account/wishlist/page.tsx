import { WishlistPage } from "@/features/wishlist/wishlist-page";
import { LoadingState } from "@technology-ecommerce/ui";
import { Suspense } from "react";

export default function MyWishlistPage() {
  return <Suspense fallback={<LoadingState message="Cargando tus deseos…" />}><WishlistPage /></Suspense>;
}
