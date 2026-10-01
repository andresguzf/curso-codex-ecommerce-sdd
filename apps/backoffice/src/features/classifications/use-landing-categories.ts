"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Category, updateCategoryRequestSchema } from "@technology-ecommerce/api-schemas";
import { useFlashStore } from "@technology-ecommerce/ui";

import { ClassificationApiError, listClassifications, updateClassification } from "./classification-api";

type EditorialCommand = { category: Category; position?: number; selected?: boolean };

export function useLandingCategories(accessToken: string, actorId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient();
  const showFlash = useFlashStore((state) => state.showFlash);
  const query = useQuery({
    enabled,
    queryKey: ["backoffice", "categories", "landing", actorId],
    queryFn: ({ signal }) => listClassifications("categories", accessToken, {
      page: 1, pageSize: 3, showOnLanding: true, view: "administrative", sortBy: "name", sortOrder: "asc",
    }, signal),
    staleTime: 0,
    gcTime: 0,
  });
  const categories = [...(query.data?.items ?? [])].sort((left, right) => (left.landingOrder ?? 4) - (right.landingOrder ?? 4));
  const mutation = useMutation({
    mutationFn: ({ category, position, selected }: EditorialCommand) => updateClassification("categories", accessToken, category.id,
      updateCategoryRequestSchema.parse(position === undefined ? { showOnLanding: selected } : { landingOrder: position })),
    onSuccess: (_category, command) => showFlash("success", command.position !== undefined
      ? "Orden de categorías actualizado." : command.selected ? "Categoría incluida en la landing." : "Categoría retirada de la landing."),
    onError: (error) => showFlash("error", error instanceof ClassificationApiError ? error.message : "No pudimos actualizar las categorías importantes. Inténtalo nuevamente."),
    // Reload even after a conflict: another administrator may have changed the slots.
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["backoffice", "categories"] }),
        queryClient.invalidateQueries({ queryKey: ["catalog", "public", "landing"] }),
      ]);
    },
  });
  const ready = enabled && query.isSuccess && !query.isFetching && !mutation.isPending;

  function select(category: Category) {
    if (!ready || category.status !== "ACTIVE" || category.showOnLanding || categories.length >= 3) return;
    mutation.mutate({ category, selected: true });
  }
  function withdraw(category: Category) {
    if (!ready) return;
    mutation.mutate({ category, selected: false });
  }
  function swap(sourceId: string, targetId: string) {
    const source = categories.find((category) => category.id === sourceId);
    const target = categories.find((category) => category.id === targetId);
    if (!ready || !source || !target || source.id === target.id || source.status !== "ACTIVE" || target.status !== "ACTIVE" || !target.landingOrder) return;
    mutation.mutate({ category: source, position: target.landingOrder });
  }
  return { categories, query, ready, isPending: mutation.isPending, select, withdraw, swap };
}
