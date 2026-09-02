import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

import frontendDependencyBoundaries from "./frontend-boundaries.mjs";

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  frontendDependencyBoundaries,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
];
