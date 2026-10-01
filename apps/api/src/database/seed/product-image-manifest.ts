/** Temporary, visually reviewed illustrations. Never a production asset source. */
type ProductKind = "laptop" | "monitor" | "keyboard" | "phone";
type Photo = Readonly<{ id: number; description: string; reviewPage: number }>;
const PHOTOS = {
  0: { id: 0, description: "Portátil plateado abierto sobre una mesa de madera, junto a un teléfono y una taza", reviewPage: 1 },
  1: { id: 1, description: "Persona utilizando el teclado de un portátil plateado sobre una mesa de madera", reviewPage: 1 },
  2: { id: 2, description: "Portátil abierto visto en diagonal, con teclado visible y teléfono sobre la mesa", reviewPage: 1 },
  3: { id: 3, description: "Persona sosteniendo un teléfono frente a un portátil abierto", reviewPage: 1 },
  5: { id: 5, description: "Manos escribiendo en el teclado de un portátil, visto desde arriba", reviewPage: 1 },
  6: { id: 6, description: "Portátil abierto con pantalla oscura, visto de lado sobre una mesa", reviewPage: 1 },
  8: { id: 8, description: "Vista superior de un portátil con teclado visible, teléfono y taza de café", reviewPage: 1 },
  9: { id: 9, description: "Vista superior de un portátil abierto y un teléfono sobre una libreta", reviewPage: 1 },
  26: { id: 26, description: "Teléfono y auriculares negros junto a accesorios personales sobre fondo gris", reviewPage: 1 },
  42: { id: 42, description: "Teléfono oscuro sobre una mesa de cafetería junto a dos tazas", reviewPage: 2 },
  48: { id: 48, description: "Parte posterior de un portátil plateado abierto, junto a un teléfono sobre una mesa", reviewPage: 2 },
  60: { id: 60, description: "Vista superior de un escritorio con monitor, teclado externo blanco, mouse y tabletas", reviewPage: 3 },
} as const satisfies Record<number, Photo>;
type PhotoId = keyof typeof PHOTOS;

// SKU is the stable join key for 20.4, not a database UUID. Existing seed SKUs
// retain their identity; these declarations do not insert or update products.
const PRODUCTS: readonly Readonly<{
  sku: string; name: string; kind: ProductKind; photos: readonly [PhotoId, PhotoId, PhotoId];
}>[] = [
  { sku: "DEV-LAPTOP-001", name: "Development Ultrabook 14", kind: "laptop", photos: [0, 1, 2] },
  { sku: "DEV-LAPTOP-002", name: "Notebook Pro 15", kind: "laptop", photos: [6, 8, 48] },
  { sku: "DEV-LAPTOP-003", name: "Notebook Compact 13", kind: "laptop", photos: [2, 5, 9] },
  { sku: "DEV-LAPTOP-004", name: "Notebook Studio 16", kind: "laptop", photos: [48, 0, 8] },
  { sku: "DEV-LAPTOP-005", name: "Notebook Office 14", kind: "laptop", photos: [8, 1, 6] },
  { sku: "DEV-LAPTOP-006", name: "Notebook Travel 13", kind: "laptop", photos: [9, 2, 48] },
  { sku: "DEV-MONITOR-001", name: "Development Monitor 27", kind: "monitor", photos: [60, 0, 6] },
  { sku: "DEV-MONITOR-002", name: "Monitor Office 24", kind: "monitor", photos: [60, 8, 9] },
  { sku: "DEV-MONITOR-003", name: "Monitor Studio 32", kind: "monitor", photos: [60, 6, 0] },
  { sku: "DEV-MONITOR-004", name: "Monitor Compact 22", kind: "monitor", photos: [60, 9, 8] },
  { sku: "DEV-KEYBOARD-001", name: "Development Mechanical Keyboard", kind: "keyboard", photos: [60, 5, 8] },
  { sku: "DEV-KEYBOARD-002", name: "Teclado Wireless Office", kind: "keyboard", photos: [60, 1, 9] },
  { sku: "DEV-KEYBOARD-003", name: "Teclado Compact 65", kind: "keyboard", photos: [60, 8, 5] },
  { sku: "DEV-KEYBOARD-004", name: "Teclado Pro Full Size", kind: "keyboard", photos: [60, 9, 1] },
  { sku: "DEV-PHONE-001", name: "Smartphone Nova 128", kind: "phone", photos: [3, 26, 42] },
  { sku: "DEV-PHONE-002", name: "Smartphone Nova 256", kind: "phone", photos: [26, 3, 42] },
  { sku: "DEV-PHONE-003", name: "Smartphone Compact 128", kind: "phone", photos: [3, 42, 26] },
  { sku: "DEV-PHONE-004", name: "Smartphone Office 128", kind: "phone", photos: [42, 3, 26] },
  { sku: "DEV-PHONE-005", name: "Smartphone Pro 256", kind: "phone", photos: [26, 42, 3] },
  { sku: "DEV-PHONE-006", name: "Smartphone Travel 128", kind: "phone", photos: [42, 26, 3] },
];

export type DevelopmentProductImage = Readonly<{
  storageKey: string;
  cloudinaryPublicId: string;
  picsumId: number;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
  width: 1200;
  height: 900;
  mimeType: "image/webp";
  format: "webp";
  fallback: Readonly<{ url: "/images/product-placeholder.svg"; altText: string }>;
  review: Readonly<{ date: "2026-10-01"; source: string; description: string; fidelity: "illustration-not-exact-model" }>;
}>;
export type DevelopmentProductImageSet = Readonly<{
  sku: string;
  name: string;
  kind: ProductKind;
  images: readonly DevelopmentProductImage[];
}>;

/** Fail closed before returning data: no NODE_ENV inference or production fallback. */
export function getDevelopmentProductImageManifest(environment: unknown): readonly DevelopmentProductImageSet[] {
  if (environment !== "development" && environment !== "test") {
    throw new Error("Demo image manifest is restricted to development and test");
  }
  return Object.freeze(PRODUCTS.map((product) => Object.freeze({
    sku: product.sku,
    name: product.name,
    kind: product.kind,
    images: Object.freeze(product.photos.map((id, sortOrder): DevelopmentProductImage => {
      const photo = PHOTOS[id];
      const slot = sortOrder === 0 ? "cover" : `gallery-${sortOrder}`;
      const stem = `products/${product.sku.toLowerCase()}/${slot}`;
      return Object.freeze({
        storageKey: `development/${stem}.webp`,
        cloudinaryPublicId: `technology-ecommerce/${stem}`,
        picsumId: id,
        url: `https://picsum.photos/id/${id}/1200/900.webp`,
        altText: `Ilustración temporal para ${product.name}: ${photo.description}`,
        isPrimary: sortOrder === 0,
        sortOrder,
        width: 1200,
        height: 900,
        mimeType: "image/webp",
        format: "webp",
        fallback: Object.freeze({ url: "/images/product-placeholder.svg", altText: `Imagen no disponible de ${product.name}` }),
        review: Object.freeze({ date: "2026-10-01", source: `https://picsum.photos/images#${photo.reviewPage}`, description: photo.description, fidelity: "illustration-not-exact-model" }),
      });
    })),
  })));
}
