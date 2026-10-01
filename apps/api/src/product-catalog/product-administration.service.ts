import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import { ProductAdministrationRepository, ProductCategoryRequiredError, ProductClassificationUnavailableError, ProductTagInactiveError, ProductTagLimitExceededError, ProductTagNameInvalidError } from "./product-administration.repository";
import { normalizeSlug } from "./slug";
import type {
  AdministrativeProduct,
  CreateAdministrativeProduct,
  ProductDetail,
  ProductListQuery,
  ProductListView,
  ProductPage,
  ProductStatus,
  UpdateAdministrativeProduct,
} from "./product-administration.types";

@Injectable()
export class ProductAdministrationService {
  constructor(
    @Inject(ProductAdministrationRepository)
    private readonly repository: ProductAdministrationRepository,
  ) {}

  list(
    query: ProductListQuery,
    actor?: AuthenticatedUser,
  ): Promise<ProductPage> {
    if (query.purpose === "autocomplete") {
      if (!actor) throw new UnauthorizedException({ code: "AUTH_UNAUTHORIZED", message: "Authentication required" });
      if (actor.role !== "ADMIN" && actor.role !== "BILLING") {
        throw new ForbiddenException({ code: "AUTH_FORBIDDEN", message: "Invoice lookup requires ADMIN or BILLING" });
      }
    }
    if (query.view === "administrative") {
      this.assertAdministrativeView(actor);
    } else if (query.status) {
      throw new BadRequestException({
        code: "PRODUCT_STATUS_FILTER_REQUIRES_ADMINISTRATIVE_VIEW",
        message: "The status filter is only available in the administrative catalog",
      });
    }

    return this.repository.list({
      ...query,
      ...(query.view === "public" ? { status: "ACTIVE" as const } : {}),
    });
  }

  async getDetail(
    productId: string,
    view: ProductListView,
    actor?: AuthenticatedUser,
  ): Promise<ProductDetail> {
    if (view === "administrative") this.assertAdministrativeView(actor);

    const product = await this.repository.findDetailById(
      productId,
      view === "administrative",
    );
    if (!product) throw this.notFound();
    return product;
  }

  async getPublicDetailBySlug(slug: string): Promise<ProductDetail> {
    const product = await this.repository.findPublicDetailBySlug(slug);
    if (!product) throw this.notFound();
    return product;
  }

  async get(productId: string): Promise<AdministrativeProduct> {
    const product = await this.repository.findById(productId);
    if (!product) throw this.notFound();
    return product;
  }

  async create(
    input: CreateAdministrativeProduct,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    try {
      return await this.repository.create(this.normalize(input), actorUserId);
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async update(
    productId: string,
    input: UpdateAdministrativeProduct,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    try {
      const product = await this.repository.update(
        productId,
        this.normalizeUpdate(input),
        actorUserId,
      );
      if (!product) throw this.notFound();
      return product;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async updateStatus(
    productId: string,
    status: ProductStatus,
    actorUserId: string,
  ): Promise<AdministrativeProduct> {
    try {
      const product = await this.repository.updateStatus(productId, status, actorUserId);
      if (!product) throw this.notFound();
      return product;
    } catch (error) {
      this.rethrowPersistenceError(error);
    }
  }

  async delete(productId: string, actorUserId: string): Promise<void> {
    if (!(await this.repository.softDelete(productId, actorUserId))) {
      throw this.notFound();
    }
  }

  private normalize(input: CreateAdministrativeProduct): CreateAdministrativeProduct {
    this.validatedSlug(input.slug ?? input.name);
    return {
      ...input,
      ...(input.slug === undefined ? {} : { slug: this.validatedSlug(input.slug) }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.tagIds === undefined ? {} : { tagIds: input.tagIds }),
      ...(input.tagNames === undefined ? {} : { tagNames: input.tagNames.map((name) => name.trim()) }),
      description: input.description.trim(),
      image: {
        storageKey: input.image.storageKey.trim(),
        url: input.image.url.trim(),
      },
      name: input.name.trim(),
      sku: input.sku.trim().toUpperCase(),
    };
  }

  private normalizeUpdate(input: UpdateAdministrativeProduct): UpdateAdministrativeProduct {
    return {
      ...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured }),
      ...(input.description === undefined
        ? {}
        : { description: input.description.trim() }),
      ...(input.image === undefined
        ? {}
        : {
            image: {
              storageKey: input.image.storageKey.trim(),
              url: input.image.url.trim(),
            },
          }),
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.price === undefined ? {} : { price: input.price }),
      ...(input.sku === undefined
        ? {}
        : { sku: input.sku.trim().toUpperCase() }),
      ...(input.slug === undefined ? {} : { slug: this.validatedSlug(input.slug) }),
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.tagIds === undefined ? {} : { tagIds: input.tagIds }),
      ...(input.tagNames === undefined ? {} : { tagNames: input.tagNames.map((name) => name.trim()) }),
    };
  }

  private rethrowPersistenceError(error: unknown): never {
    if (error instanceof ProductCategoryRequiredError) {
      throw new BadRequestException({ code: "PRODUCT_CATEGORY_REQUIRED", message: "An active product requires a category" });
    }
    if (error instanceof ProductClassificationUnavailableError) {
      throw new BadRequestException({ code: "PRODUCT_CLASSIFICATION_UNAVAILABLE", message: "The selected category or tag is not active" });
    }
    if (error instanceof ProductTagLimitExceededError) {
      throw new BadRequestException({ code: "PRODUCT_TAG_LIMIT_EXCEEDED", message: "A product can have at most 20 distinct tags", details: [{ field: "tagNames", message: "Select at most 20 distinct tags" }] });
    }
    if (error instanceof ProductTagInactiveError) {
      throw new BadRequestException({ code: "PRODUCT_TAG_INACTIVE", message: "The tag is no longer available", details: [{ field: "tagNames", message: "Choose an active tag" }] });
    }
    if (error instanceof ProductTagNameInvalidError) {
      throw new BadRequestException({ code: "PRODUCT_TAG_NAME_INVALID", message: "A tag name must contain letters or numbers", details: [{ field: "tagNames", message: "Enter a valid tag name" }] });
    }
    const constraint = this.findPostgresConstraint(error);
    if (constraint === "products_sku_unique") {
      throw new ConflictException({
        code: "PRODUCT_SKU_ALREADY_EXISTS",
        message: "A product with this SKU already exists",
      });
    }
    if (constraint === "products_slug_unique") {
      throw new ConflictException({
        code: "PRODUCT_SLUG_ALREADY_EXISTS",
        message: "A product with this slug already exists",
      });
    }
    if (constraint === "product_images_storage_key_unique") {
      throw new ConflictException({
        code: "PRODUCT_IMAGE_ALREADY_ASSIGNED",
        message: "The image is already assigned to another product",
      });
    }
    throw error;
  }

  private validatedSlug(value: string): string {
    try {
      return normalizeSlug(value);
    } catch {
      throw new BadRequestException({
        code: "PRODUCT_SLUG_INVALID",
        message: "A product slug must contain letters or numbers",
      });
    }
  }

  private assertAdministrativeView(actor?: AuthenticatedUser): void {
    if (!actor) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_SESSION",
        message: "An authenticated administrator is required",
      });
    }
    if (actor.role !== "ADMIN") {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "You do not have permission to view the administrative catalog",
      });
    }
  }

  private findPostgresConstraint(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 3 && current; depth += 1) {
      if (typeof current === "object" && "constraint" in current) {
        return typeof current.constraint === "string"
          ? current.constraint
          : undefined;
      }
      current =
        typeof current === "object" && "cause" in current
          ? current.cause
          : undefined;
    }
    return undefined;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "PRODUCT_NOT_FOUND",
      message: "The requested product does not exist",
    });
  }
}
