"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserRequestSchema,
  type AdministrativeUser,
  type CreateUserRequest,
  type UpdateUserRequest,
} from "@technology-ecommerce/api-schemas";
import { IconButton, TextField } from "@technology-ecommerce/ui";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = createUserRequestSchema.pick({ displayName: true, email: true, role: true }).extend({
  password: z.string().max(128),
});
type FormValues = z.infer<typeof formSchema>;

export function UserForm({
  isPending,
  onCancel,
  onSubmit,
  user,
}: Readonly<{
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateUserRequest | UpdateUserRequest) => void;
  user?: AdministrativeUser;
}>) {
  const schema = formSchema.superRefine((input, context) => {
    if (!user && input.password.length < 12) {
      context.addIssue({ code: "custom", message: "Usa al menos 12 caracteres.", path: ["password"] });
    }
    if (user && input.password.length > 0 && input.password.length < 12) {
      context.addIssue({ code: "custom", message: "Usa al menos 12 caracteres o deja el campo vacío.", path: ["password"] });
    }
  });
  const { formState, handleSubmit, register } = useForm<FormValues>({
    defaultValues: {
      displayName: user?.displayName ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "CUSTOMER",
      password: "",
    },
    resolver: zodResolver(schema),
  });

  function submit(input: FormValues) {
    if (user) {
      onSubmit({
        displayName: input.displayName,
        email: input.email,
        role: input.role,
        ...(input.password ? { password: input.password } : {}),
      });
    } else {
      onSubmit({ ...input, status: "ACTIVE" });
    }
  }

  return (
    <form className="grid gap-5" noValidate onSubmit={handleSubmit(submit)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField autoComplete="name" error={formState.errors.displayName?.message} id="user-display-name" label="Nombre" {...register("displayName")} />
        <TextField autoComplete="email" error={formState.errors.email?.message} id="user-email" label="Correo electrónico" type="email" {...register("email")} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-800" htmlFor="user-role">Rol</label>
          <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" id="user-role" {...register("role")}>
            <option value="CUSTOMER">Cliente</option>
            <option value="ADMIN">Administrador</option>
            <option value="BILLING">Facturación</option>
          </select>
          <p className="m-0 text-xs text-slate-500">Los permisos se aplican en el API según el rol.</p>
        </div>
        <TextField
          autoComplete="new-password"
          error={formState.errors.password?.message}
          hint={user ? "Déjala vacía para conservar la contraseña actual." : "Mínimo 12 caracteres."}
          id="user-password"
          label={user ? "Nueva contraseña (opcional)" : "Contraseña inicial"}
          type="password"
          {...register("password")}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <IconButton className="border-slate-300 text-slate-800 hover:bg-slate-100" disabled={isPending} icon="x" label="Cancelar" onClick={onCancel} />
        <IconButton className="border-[#15345b] bg-[#15345b] text-white hover:bg-blue-800" disabled={isPending} icon="check" label={isPending ? "Guardando…" : user ? "Guardar usuario" : "Crear usuario"} type="submit" />
      </div>
    </form>
  );
}
