import type { Page } from "@playwright/test";

export const catalogCloudUrl = "https://res.cloudinary.com/ui-test/image/upload/v123/codex-storefront/cover.png";
export const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVQImWNgYGjAgQZQAgDw8BgBXuIwQQAAAABJRU5ErkJggg==", "base64");

export async function installCloudImageDelivery(page: Page, fail = false): Promise<void> {
  // Browser rendering test only. No remote account or optimizer upstream call.
  await page.route("https://res.cloudinary.com/**", (route) => route.fulfill({ status: fail ? 404 : 200, contentType: fail ? "text/plain" : "image/png", body: fail ? "Not found" : imageBytes }));
  await page.route("**/_next/image?**", (route) => route.fulfill({ status: fail ? 404 : 200, contentType: fail ? "text/plain" : "image/png", body: fail ? "Not found" : imageBytes }));
}
