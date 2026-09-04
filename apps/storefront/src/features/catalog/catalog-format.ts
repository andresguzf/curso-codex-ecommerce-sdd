export function formatProductPrice(price: string, currency: string): string {
  return new Intl.NumberFormat("es-CL", {
    currency,
    maximumFractionDigits: currency === "CLP" ? 0 : 2,
    style: "currency",
  }).format(Number(price));
}
