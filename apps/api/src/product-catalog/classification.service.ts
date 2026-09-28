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
import { ClassificationRepository } from "./classification.repository";
import type {
  CategoryRecord,
  ClassificationInput,
  ClassificationKind,
  ClassificationPage,
  ClassificationPatch,
  ClassificationQuery,
  ClassificationRecord,
  TagRecord,
} from "./classification.types";
import { normalizeSlug, slugCandidate } from "./slug";

@Injectable()
export class ClassificationService {
  constructor(@Inject(ClassificationRepository) private readonly repository: ClassificationRepository) {}

  async listCategories(query: ClassificationQuery, actor?: AuthenticatedUser): Promise<ClassificationPage<CategoryRecord>> {
    this.checkView(query, actor);
    const page = await this.repository.list("category", query);
    return { ...page, items: page.items.map((item) => this.asCategory(item)) };
  }

  async listTags(query: ClassificationQuery, actor?: AuthenticatedUser): Promise<ClassificationPage<TagRecord>> {
    this.checkView(query, actor);
    const page = await this.repository.list("tag", query);
    return { ...page, items: page.items.map((item) => this.asTag(item)) };
  }

  async getCategory(id: string, administrative: boolean, actor?: AuthenticatedUser): Promise<CategoryRecord> {
    if (administrative) this.assertAdmin(actor);
    return this.asCategory(await this.get("category", id, administrative));
  }

  async getTag(id: string, administrative: boolean, actor?: AuthenticatedUser): Promise<TagRecord> {
    if (administrative) this.assertAdmin(actor);
    return this.asTag(await this.get("tag", id, administrative));
  }

  async createCategory(input: ClassificationInput, actorUserId: string): Promise<CategoryRecord> {
    return this.asCategory(await this.create("category", input, actorUserId));
  }

  async createTag(input: ClassificationInput, actorUserId: string): Promise<TagRecord> {
    return this.asTag(await this.create("tag", input, actorUserId));
  }

  async updateCategory(id: string, input: ClassificationPatch, actorUserId: string): Promise<CategoryRecord> {
    return this.asCategory(await this.update("category", id, input, actorUserId));
  }

  async updateTag(id: string, input: ClassificationPatch, actorUserId: string): Promise<TagRecord> {
    return this.asTag(await this.update("tag", id, input, actorUserId));
  }

  async deleteCategory(id: string, actorUserId: string): Promise<void> {
    await this.delete("category", id, actorUserId);
  }

  async deleteTag(id: string, actorUserId: string): Promise<void> {
    await this.delete("tag", id, actorUserId);
  }

  private checkView(query: ClassificationQuery, actor?: AuthenticatedUser): void {
    if (query.view === "administrative") this.assertAdmin(actor);
    else if (query.status) {
      throw new BadRequestException({ code: "CLASSIFICATION_STATUS_FILTER_REQUIRES_ADMIN", message: "Status filtering requires the administrative view" });
    }
  }

  private assertAdmin(actor?: AuthenticatedUser): void {
    if (!actor) throw new UnauthorizedException({ code: "AUTH_INVALID_SESSION", message: "An administrator session is required" });
    if (actor.role !== "ADMIN") throw new ForbiddenException({ code: "AUTH_FORBIDDEN", message: "Administrator access is required" });
  }

  private async get(kind: ClassificationKind, id: string, administrative: boolean): Promise<ClassificationRecord> {
    const record = await this.repository.find(kind, id, administrative);
    if (!record) throw this.notFound(kind);
    return record;
  }

  private async create(kind: ClassificationKind, input: ClassificationInput, actorUserId: string): Promise<ClassificationRecord> {
    const normalizedName = input.name.trim();
    const base = this.validatedSlug(input.slug ?? normalizedName, kind === "category" ? 220 : 140);
    for (let attempt = 1; attempt <= 1000; attempt += 1) {
      try {
        return await this.repository.create(kind, {
          ...input,
          name: normalizedName,
          slug: slugCandidate(base, attempt, kind === "category" ? 220 : 140),
          ...(kind === "category" ? { description: input.description?.trim() ?? "" } : {}),
        }, actorUserId);
      } catch (error) {
        if (!input.slug && this.constraint(error) === `${kind === "category" ? "categories" : "tags"}_slug_unique` && attempt < 1000) continue;
        this.rethrowPersistenceError(kind, error);
      }
    }
    throw new ConflictException({ code: "CLASSIFICATION_SLUG_UNAVAILABLE", message: "No available slug could be allocated" });
  }

  private async update(kind: ClassificationKind, id: string, input: ClassificationPatch, actorUserId: string): Promise<ClassificationRecord> {
    const normalized: ClassificationPatch = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.slug === undefined ? {} : { slug: this.validatedSlug(input.slug, kind === "category" ? 220 : 140) }),
      ...(input.description === undefined ? {} : { description: input.description.trim() }),
      ...(input.status === undefined ? {} : { status: input.status }),
    };
    try {
      const updated = await this.repository.update(kind, id, normalized, actorUserId);
      if (!updated) throw this.notFound(kind);
      return updated;
    } catch (error) {
      this.rethrowPersistenceError(kind, error);
    }
  }

  private async delete(kind: ClassificationKind, id: string, actorUserId: string): Promise<void> {
    if (!(await this.repository.softDelete(kind, id, actorUserId))) throw this.notFound(kind);
  }

  private validatedSlug(value: string, maxLength: number): string {
    try { return normalizeSlug(value, maxLength); }
    catch { throw new BadRequestException({ code: "CLASSIFICATION_SLUG_INVALID", message: "The slug must contain letters or numbers" }); }
  }

  private constraint(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current; depth += 1) {
      if (typeof current === "object" && "constraint" in current && typeof current.constraint === "string") return current.constraint;
      current = typeof current === "object" && "cause" in current ? current.cause : undefined;
    }
    return undefined;
  }

  private rethrowPersistenceError(kind: ClassificationKind, error: unknown): never {
    if (error instanceof NotFoundException) throw error;
    const prefix = kind === "category" ? "categories" : "tags";
    const constraint = this.constraint(error);
    if (constraint === `${prefix}_name_unique`) throw new ConflictException({ code: "CLASSIFICATION_NAME_ALREADY_EXISTS", message: "A classification with this name already exists" });
    if (constraint === `${prefix}_slug_unique`) throw new ConflictException({ code: "CLASSIFICATION_SLUG_ALREADY_EXISTS", message: "A classification with this slug already exists" });
    throw error;
  }

  private notFound(kind: ClassificationKind): NotFoundException {
    return new NotFoundException({ code: kind === "category" ? "CATEGORY_NOT_FOUND" : "TAG_NOT_FOUND", message: "The requested classification does not exist" });
  }

  private asCategory(record: ClassificationRecord): CategoryRecord {
    return { ...record, description: record.description ?? "" };
  }

  private asTag(record: ClassificationRecord): TagRecord {
    const { description: _description, ...tag } = record;
    void _description;
    return tag;
  }
}
