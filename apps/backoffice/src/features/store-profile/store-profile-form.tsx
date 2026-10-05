"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { storeProfileFormSchema, type StoreProfile, type StoreProfileFormValues } from "@technology-ecommerce/api-schemas";
import { TextField } from "@technology-ecommerce/ui";
import { useForm } from "react-hook-form";

import type { StoreProfilePatch } from "./store-profile-api";

export function StoreProfileForm({ profile, isPending, onSubmit }: Readonly<{
  profile: StoreProfile | null;
  isPending: boolean;
  onSubmit: (input: StoreProfilePatch) => void;
}>) {
  const { formState, handleSubmit, register } = useForm<StoreProfileFormValues>({
    defaultValues: {
      tradeName: profile?.tradeName ?? "",
      legalName: profile?.legalName ?? "",
      taxIdentifier: profile?.taxIdentifier ?? "",
      line1: profile?.address.line1 ?? "",
      line2: profile?.address.line2 ?? "",
      city: profile?.address.city ?? "",
      region: profile?.address.region ?? "",
      postalCode: profile?.address.postalCode ?? "",
      countryCode: profile?.address.countryCode ?? "CL",
      email: profile?.contact.email ?? "",
      phone: profile?.contact.phone ?? "",
    },
    resolver: zodResolver(storeProfileFormSchema),
  });
  const errors = formState.errors;


  function submit(value: StoreProfileFormValues) {
    onSubmit({
      tradeName: value.tradeName,
      legalName: value.legalName,
      taxIdentifier: value.taxIdentifier,
      address: {
        line1: value.line1,
        line2: value.line2 || null,
        city: value.city,
        region: value.region || null,
        postalCode: value.postalCode || null,
        countryCode: value.countryCode,
      },
      contact: { email: value.email || null, phone: value.phone || null },
    });
  }

  return (
    <form className="grid gap-6" noValidate onSubmit={handleSubmit(submit)}>
      <section aria-labelledby="company-identity-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="m-0 text-xs font-bold uppercase tracking-[.18em] text-blue-800">01 · Identidad fiscal</p>
        <h2 className="mb-5 mt-2 text-xl font-bold" id="company-identity-heading">Datos del emisor</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField error={errors.tradeName?.message} id="profile-trade-name" label="Nombre comercial" maxLength={200} required {...register("tradeName")} />
          <TextField error={errors.legalName?.message} id="profile-legal-name" label="Razón social" maxLength={200} required {...register("legalName")} />
          <TextField error={errors.taxIdentifier?.message} hint="RUT, NIF o identificador fiscal aplicable." id="profile-tax-id" label="Identificador fiscal" maxLength={80} required {...register("taxIdentifier")} />
        </div>
      </section>

      <section aria-labelledby="company-address-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="m-0 text-xs font-bold uppercase tracking-[.18em] text-blue-800">02 · Ubicación</p>
        <h2 className="mb-5 mt-2 text-xl font-bold" id="company-address-heading">Dirección física</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField className="md:col-span-2" error={errors.line1?.message} id="profile-line1" label="Dirección principal" maxLength={250} required {...register("line1")} />
          <TextField error={errors.line2?.message} id="profile-line2" label="Complemento (opcional)" maxLength={250} {...register("line2")} />
          <TextField error={errors.city?.message} id="profile-city" label="Ciudad" maxLength={120} required {...register("city")} />
          <TextField error={errors.region?.message} id="profile-region" label="Región o provincia (opcional)" maxLength={120} {...register("region")} />
          <TextField error={errors.postalCode?.message} id="profile-postal-code" label="Código postal (opcional)" maxLength={32} {...register("postalCode")} />
          <TextField error={errors.countryCode?.message} hint="Código ISO de dos letras, por ejemplo CL." id="profile-country" label="País" maxLength={2} required {...register("countryCode")} />
        </div>
      </section>

      <section aria-labelledby="company-contact-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="m-0 text-xs font-bold uppercase tracking-[.18em] text-blue-800">03 · Contacto y marca</p>
        <h2 className="mb-5 mt-2 text-xl font-bold" id="company-contact-heading">Contacto y logo</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField error={errors.email?.message} id="profile-email" label="Correo de contacto (opcional)" type="email" {...register("email")} />
          <TextField error={errors.phone?.message} id="profile-phone" label="Teléfono (opcional)" maxLength={40} type="tel" {...register("phone")} />
        </div>
        <fieldset className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <legend className="px-2 text-sm font-bold text-slate-800">Logo de la tienda</legend>
          <p className="mt-0 text-sm text-slate-600">Logo empresarial fijo. Se incluye en las nuevas órdenes y facturas; los documentos anteriores conservan su identidad histórica.</p>
          {profile?.logo ? <div className="flex flex-wrap items-center gap-4">
            {/* Trusted SVG from the REST API; no image optimizer or upload needed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Logo empresarial Tech Store" className="h-16 w-48 rounded-lg" height={80} src={profile.logo.url} width={240} />
            <a className="text-sm font-semibold text-blue-800 underline" href={profile.logo.url} rel="noopener noreferrer" target="_blank">Ver logo empresarial</a>
          </div> : <p className="text-sm text-slate-600">El API asignará el logo fijo al configurar el perfil.</p>}
        </fieldset>
      </section>
      <div className="flex justify-end border-t border-slate-300 pt-5">
        <button className="min-h-11 rounded-lg bg-[#15345b] px-6 font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={isPending} type="submit">{isPending ? "Guardando…" : "Guardar perfil empresarial"}</button>
      </div>
    </form>
  );
}
