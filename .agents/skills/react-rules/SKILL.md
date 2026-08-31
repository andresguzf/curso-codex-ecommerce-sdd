---
name: react-rules
description: Crea y modifica aplicaciones, componentes, hooks, estado, formularios y lógica de UI en React con TypeScript, Tailwind, Zustand y Zod. Úsalo ante cualquier solicitud de trabajo en React; no aplica a frontends que no usan React.
---

# React Rules

Construye o adapta el frontend respetando la arquitectura existente. En proyectos nuevos, usa una estructura React con TypeScript organizada por responsabilidades y funcionalidades, por ejemplo:

```text
src/
├── app/                 # composición, providers, router y estilos globales
├── components/ui/       # componentes presentacionales reutilizables
├── features/<feature>/  # components, hooks, api, schemas, store y types
├── hooks/               # hooks compartidos
├── lib/                 # clientes y utilidades compartidas
└── styles/              # estilos globales cuando sean necesarios
```

No fuerces esta estructura sobre un repositorio existente si sus convenciones ya separan claramente esas responsabilidades.

## Plataforma y dependencias

- Usa TypeScript, archivos `.ts`/`.tsx` y tipos explícitos en los límites de componentes, hooks, stores y API. Evita `any` salvo que exista una justificación concreta.
- Usa Tailwind CSS para estilos. Sigue la versión y configuración del proyecto; en uno nuevo instala y configura la versión estable compatible con el framework elegido.
- Antes de crear o actualizar el proyecto, consulta la versión `latest` estable en [npm: react](https://www.npmjs.com/package/react). Usa React `19.2.8` o una versión estable posterior disponible y mantén `react-dom` alineado. No elijas versiones canary, experimental, beta o RC salvo petición explícita.
- Instala Zustand, Zod, React Hook Form y `@hookform/resolvers` cuando la funcionalidad los requiera; no añadas dependencias sin uso real.

## Componentes, estado y hooks

- Mantén componentes pequeños, simples y con una sola responsabilidad. Extrae piezas cuando combinen responsabilidades independientes, no solo para reducir líneas.
- Mantén componentes y hooks puros: no produzcas side effects durante el render.
- Nunca llames hooks dentro de bucles, condicionales, funciones anidadas ni después de retornos condicionales.
- No mutes estado, objetos ni arrays directamente. Produce copias nuevas en actualizaciones locales y globales.
- Para estado global usa Zustand con `create()` y define juntos el tipo del estado y sus acciones. Expón selectores acotados para evitar renders innecesarios.
- Extrae lógica reutilizable en custom hooks como `useAuth` o `useProducts`; comparte lógica entre eventos mediante funciones reutilizables o hooks.
- La lógica provocada por una interacción del usuario pertenece al event handler que la recibe, no a un `useEffect`.
- Comunica cambios al padre mediante callbacks tipados por props y ejecútalos desde el componente hijo en el evento correspondiente.
- Usa `useMemo` únicamente para cálculos realmente costosos o cuando la estabilidad referencial sea necesaria; no lo uses por defecto.
- Para reiniciar o ajustar estado, prefiere una `key`, deriva el valor desde props/estado durante el render o actualízalo en el evento correspondiente.

## Effects

- Usa `useEffect` solo para sincronizar React con sistemas externos, como APIs imperativas, DOM no administrado, suscripciones o librerías de terceros.
- No uses `useEffect` para calcular valores derivados de props o estado. Calcúlalos durante el render o en handlers.
- Mantén cada effect simple, con cleanup cuando corresponda y dependencias completas y claras.

## Datos, validación y formularios

- El frontend consume datos exclusivamente mediante API REST.
- Para datos remotos compartidos o reutilizados usa TanStack Query (React Query) o SWR, aprovechando caché, deduplicación y refetch. Mantén el cliente REST separado de los componentes.
- Valida entradas y respuestas no confiables con esquemas Zod, usando constructores como `z.object()` y `z.string()`, y ejecuta `parse()` cuando el fallo deba interrumpir el flujo o `safeParse()` cuando deba manejarse explícitamente.
- Integra formularios con React Hook Form y Zod mediante `zodResolver`. Deriva el tipo del formulario desde el esquema con `z.infer` para mantener una sola fuente de verdad.
- En Next.js con TypeScript, no uses Server Actions para lógica de negocio ni acceso a datos. Usa endpoints REST y un cliente REST desde el frontend.

## Verificación

Después de los cambios, ejecuta los comandos disponibles del proyecto para typecheck, lint, pruebas y build en proporción al alcance. Corrige errores introducidos por el trabajo antes de entregar.
