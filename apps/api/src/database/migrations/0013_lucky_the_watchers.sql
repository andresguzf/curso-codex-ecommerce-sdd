DROP INDEX "product_images_product_unique";--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "alt_text" text DEFAULT 'Imagen del producto' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "is_primary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "product_images" ADD COLUMN "mime_type" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_primary_unique" ON "product_images" USING btree ("product_id") WHERE "product_images"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_order_unique" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_alt_text_not_blank" CHECK (btrim("product_images"."alt_text") <> '');--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_sort_order_non_negative" CHECK ("product_images"."sort_order" >= 0);--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_width_positive" CHECK ("product_images"."width" is null or "product_images"."width" > 0);--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_height_positive" CHECK ("product_images"."height" is null or "product_images"."height" > 0);--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_mime_type_image" CHECK ("product_images"."mime_type" is null or "product_images"."mime_type" ~ '^image/[a-z0-9.+-]+$');--> statement-breakpoint
-- Preserve the former single image as the cover; unknown metadata stays NULL.
UPDATE product_images i SET alt_text = p.name FROM products p WHERE p.id = i.product_id;--> statement-breakpoint
-- Preserve visibility of legacy active products without an image with a local fallback.
INSERT INTO product_images (product_id, storage_key, url, alt_text)
SELECT p.id, 'products/legacy-fallback/' || p.id::text, '/images/product-placeholder.svg',
       'Imagen no disponible: ' || p.name
FROM products p WHERE p.status = 'ACTIVE' AND p.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id);--> statement-breakpoint

CREATE FUNCTION lock_product_image_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_ids uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN owner_ids := ARRAY[NEW.product_id];
  ELSIF TG_OP = 'DELETE' THEN owner_ids := ARRAY[OLD.product_id];
  ELSE owner_ids := ARRAY[OLD.product_id, NEW.product_id]; END IF;
  -- A write serializes owners and also prevents write skew under repeatable read.
  PERFORM id FROM products WHERE id = ANY(owner_ids) ORDER BY id FOR UPDATE;
  UPDATE products SET id = id WHERE id = ANY(owner_ids);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER product_images_lock_owner BEFORE INSERT OR UPDATE OR DELETE ON product_images
FOR EACH ROW EXECUTE FUNCTION lock_product_image_owner();--> statement-breakpoint

CREATE FUNCTION check_product_primary_image() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_ids uuid[]; owner_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN owner_ids := ARRAY[NEW.id];
  ELSIF TG_OP = 'INSERT' THEN owner_ids := ARRAY[NEW.product_id];
  ELSIF TG_OP = 'DELETE' THEN owner_ids := ARRAY[OLD.product_id];
  ELSE owner_ids := ARRAY[OLD.product_id, NEW.product_id]; END IF;
  FOREACH owner_id IN ARRAY owner_ids LOOP
    IF EXISTS (SELECT 1 FROM products WHERE id = owner_id AND status = 'ACTIVE' AND deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = owner_id AND is_primary) THEN
      RAISE EXCEPTION 'An active product requires a primary image'
        USING ERRCODE = '23514', CONSTRAINT = 'products_active_primary_image_required';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER products_require_primary_image AFTER INSERT OR UPDATE ON products
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_product_primary_image();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER product_images_require_primary_image AFTER INSERT OR UPDATE OR DELETE ON product_images
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_product_primary_image();
