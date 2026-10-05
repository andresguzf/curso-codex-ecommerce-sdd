/** Refuse manual previews before creating pools or contacting image storage. */
export function assertDeploymentRuntime(environment: Readonly<Record<string, string | undefined>>): void {
  if (environment.VERCEL === "1" && environment.VERCEL_ENV !== "production") {
    throw new Error("This course API permits only production Vercel deployments; previews must use isolated resources");
  }
}
