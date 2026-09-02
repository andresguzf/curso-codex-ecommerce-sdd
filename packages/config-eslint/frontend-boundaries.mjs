export const frontendDependencyBoundaries = {
  name: "technology-ecommerce/frontend-dependency-boundaries",
  files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            regex: "^@technology-ecommerce/api(?:/.*)?$",
            message:
              "No importes dominio o persistencia internos del API desde una aplicación frontend.",
          },
          {
            regex:
              "^(?:@prisma/client|drizzle-kit|drizzle-orm|knex|kysely|pg|postgres|prisma|sequelize|typeorm)(?:/.*)?$",
            message:
              "El acceso a ORM o PostgreSQL pertenece exclusivamente a apps/api.",
          },
          {
            group: [
              "../../../api",
              "../../../api/**",
              "../../../../api",
              "../../../../api/**",
              "../../../../../api",
              "../../../../../api/**",
              "../../../../../../api",
              "../../../../../../api/**",
            ],
            message:
              "No atravieses el límite de apps para importar código interno de apps/api.",
          },
        ],
      },
    ],
  },
};

export default frontendDependencyBoundaries;
