"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { storeProfileFormSchema, type StoreProfile, type StoreProfileFormValues, type UploadedStoreLogo } from "@technology-ecommerce/api-schemas";
import { TextField } from "@technology-ecommerce/ui";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import type { StoreProfilePatch } from "./store-profile-api";

export function StoreProfileForm({ profile, isPending, isUploading, onSubmit, onUpload }: Readonly<{
  profile: StoreProfile | null;
  isPending: boolean;
  isUploading: boolean;
  onSubmit: (input: StoreProfilePatch) => void;
  onUpload: (file: File) => Promise<UploadedStoreLogo>;
}>) {
  const [logoUrl, setLogoUrl] = useState(profile?.logo?.url ?? "");
  const [uploadError, setUploadError] = useState("");
  const { control, formState, handleSubmit, register, setValue } = useForm<StoreProfileFormValues>({
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
      logoMode: profile?.logo ? "reference" : "none",
      logoStorageKey: profile?.logo?.storageKey ?? "",
    },
    resolver: zodResolver(storeProfileFormSchema),
  });
  const logoMode = useWatch({ control, name: "logoMode" });
  const errors = formState.errors;

  async function selectLogo(file: File | undefined) {
    if (!file) return;
    setUploadError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadError("Selecciona una imagen PNG, JPEG o WebP.");
      return;
    }
    try {
      const uploaded = await onUpload(file);
      setValue("logoStorageKey", uploaded.storageKey, { shouldValidate: true });
      setValue("logoMode", "reference", { shouldValidate: true });
      setLogoUrl(uploaded.url);
    } catch {
      setUploadError("No se pudo cargar el logo. Comprueba el archivo e inténtalo nuevamente.");
    }
  }

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
      logo: value.logoMode === "reference" ? { storageKey: value.logoStorageKey } : null,
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
          <p className="mt-0 text-sm text-slate-600">Carga una imagen PNG, JPEG o WebP. El logo anterior se conserva para documentos históricos.</p>
          <div className="flex flex-wrap gap-5 text-sm font-semibold text-slate-800">
            <label className="flex min-h-11 items-center gap-2"><input type="radio" value="none" {...register("logoMode")} /> Sin logo</label>
            <label className="flex min-h-11 items-center gap-2"><input type="radio" value="reference" {...register("logoMode")} /> Usar logo cargado</label>
          </div>
          <input type="hidden" {...register("logoStorageKey")} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 hover:border-blue-600 focus-within:ring-2 focus-within:ring-blue-700">
              {isUploading ? "Cargando logo…" : "Seleccionar imagen"}
              <input accept="image/png,image/jpeg,image/webp" aria-label="Seleccionar logo" className="sr-only" disabled={isUploading} onChange={(event) => { void selectLogo(event.target.files?.[0]); event.target.value = ""; }} type="file" />
            </label>
            {logoMode === "reference" && logoUrl ? <a className="text-sm font-semibold text-blue-800 underline" href={logoUrl} rel="noopener noreferrer" target="_blank">Ver logo seleccionado</a> : null}
          </div>
          {errors.logoStorageKey?.message ? <p role="alert" className="mt-2 text-sm text-red-700">{errors.logoStorageKey.message}</p> : null}
          {uploadError ? <p role="alert" className="mt-2 text-sm text-red-700">{uploadError}</p> : null}
        </fieldset>
      </section>
      <div className="flex justify-end border-t border-slate-300 pt-5">
        <button className="min-h-11 rounded-lg bg-[#15345b] px-6 font-bold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={isPending || isUploading} type="submit">{isPending ? "Guardando…" : "Guardar perfil empresarial"}</button>
      </div>
    </form>
  );
}
