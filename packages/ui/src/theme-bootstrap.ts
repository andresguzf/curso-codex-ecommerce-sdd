export type ThemeApplication = "storefront" | "backoffice";
export type Theme = "light" | "dark";

export function themeStorageKey(application: ThemeApplication) {
  return `technology-ecommerce:${application}:theme`;
}

/** Blocking head bootstrap: no account, API or browser secret participates. */
export function themeBootstrapScript(application: ThemeApplication) {
  return `(function(){var theme=null;try{theme=localStorage.getItem(${JSON.stringify(themeStorageKey(application))});}catch(e){}if(theme!=="light"&&theme!=="dark"){theme=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var root=document.documentElement;root.dataset.designSystem=${JSON.stringify(application)};root.dataset.theme=theme;root.style.colorScheme=theme;})();`;
}
