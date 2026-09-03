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
import { ProductAdministrationRepository } from "./product-administration.repository";
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
      ...(query.currency
        ? { currency: query.currency.trim().toUpperCase() }
        : {}),
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
    const product = await this.repository.updateStatus(
      productId,
      status,
      actorUserId,
    );
    if (!product) throw this.notFound();
    return product;
  }

  async delete(productId: string, actorUserId: string): Promise<void> {
    if (!(await this.repository.softDelete(productId, actorUserId))) {
      throw this.notFound();
    }
  }

  private normalize(input: CreateAdministrativeProduct): CreateAdministrativeProduct {
    return {
      ...input,
      currency: input.currency.trim().toUpperCase(),
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
      ...(input.currency === undefined
        ? {}
        : { currency: input.currency.trim().toUpperCase() }),
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
    };
  }

  private rethrowPersistenceError(error: unknown): never {
    const constraint = this.findPostgresConstraint(error);
    if (constraint === "products_sku_unique") {
      throw new ConflictException({
        code: "PRODUCT_SKU_ALREADY_EXISTS",
        message: "A product with this SKU already exists",
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
