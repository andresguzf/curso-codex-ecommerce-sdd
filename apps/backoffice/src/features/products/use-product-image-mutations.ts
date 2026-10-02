"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlashStore } from "@technology-ecommerce/ui";
import { useEffect, useRef } from "react";
import type { UpdateProductImageRequest } from "@technology-ecommerce/api-schemas";

import { useSessionStore } from "../auth/session";
import { ProductImageApiError, uploadProductImage, updateProductImage, deleteProductImage } from "./product-image-api";

type Command = { kind: "upload"; file: File; altText: string } | { kind: "edit"; imageId: string; input: UpdateProductImageRequest } | { kind: "delete"; imageId: string };

/** One lock for every mutation in a gallery, including uploads. */
export function useProductImageMutations(productId: string, onPendingChange?: (pending: boolean) => void) {
  const { session } = useSessionStore();
  const actorId = session?.user.id;
  const queryClient = useQueryClient();
  const showFlash = useFlashStore((state) => state.showFlash);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [productId, actorId]);

  function stillAuthorized() {
    const current = useSessionStore.getState();
    return current.status === "authenticated" && current.session?.user.role === "ADMIN" && current.session.user.id === actorId;
  }
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["backoffice", "product-gallery", actorId, productId], exact: true }),
      queryClient.invalidateQueries({ queryKey: ["backoffice", "products"] }),
    ]);
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (command: Command) => {
      if (!stillAuthorized() || !session) throw new ProductImageApiError(403);
      controller.current = new AbortController();
      if (command.kind === "delete") {
        await deleteProductImage(session.accessToken, productId, command.imageId, controller.current.signal);
        return true;
      }
      return command.kind === "upload"
        ? uploadProductImage(session.accessToken, productId, command.file, { altText: command.altText }, controller.current.signal)
        : updateProductImage(session.accessToken, productId, command.imageId, command.input, controller.current.signal);
    },
    onSuccess: async (_image, command) => {
      if (!stillAuthorized()) return;
      showFlash("success", command.kind === "upload" ? "Imagen subida correctamente." : command.kind === "delete" ? "Imagen eliminada correctamente." : "Galería actualizada correctamente.");
      await refresh();
    },
    onError: async (error: Error, command) => {
      if (!stillAuthorized() || error.name === "AbortError") return;
      showFlash("error", error instanceof ProductImageApiError ? error.message : `No se pudo ${command.kind === "upload" ? "subir" : command.kind === "delete" ? "eliminar" : "actualizar"} la imagen. Revisa la galería antes de reintentar.`);
      // A lost response may have committed. Recover the authoritative gallery
      // before allowing another explicit attempt; never replay a mutation.
      await refresh();
    },
    onSettled: () => {
      locked.current = false;
      controller.current = null;
      onPendingChange?.(false);
    },
  });

  async function run(command: Command) {
    if (locked.current) return undefined;
    locked.current = true;
    onPendingChange?.(true);
    try { return await mutation.mutateAsync(command); }
    catch { return undefined; } // Error feedback is handled once in onError.
  }
  return {
    upload: (file: File, altText: string) => run({ kind: "upload", file, altText }),
    update: (imageId: string, input: UpdateProductImageRequest) => run({ kind: "edit", imageId, input }),
    remove: (imageId: string) => run({ kind: "delete", imageId }),
    isPending: mutation.isPending,
  };
}
