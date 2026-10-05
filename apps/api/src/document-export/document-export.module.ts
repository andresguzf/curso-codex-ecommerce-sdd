import { Module } from "@nestjs/common";

import { DocumentExportService } from "./document-export.service.js";
import { PDF_RENDERER } from "./pdf-renderer.port.js";
import { SimplePdfAdapter } from "./simple-pdf.adapter.js";
import { ImageStorageModule } from "../product-catalog/image-storage/image-storage.module.js";

@Module({
  imports: [ImageStorageModule],
  providers: [DocumentExportService, { provide: PDF_RENDERER, useClass: SimplePdfAdapter }],
  exports: [DocumentExportService],
})
export class DocumentExportModule {}
