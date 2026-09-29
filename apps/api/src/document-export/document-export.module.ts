import { Module } from "@nestjs/common";

import { DocumentExportService } from "./document-export.service";
import { PDF_RENDERER } from "./pdf-renderer.port";
import { SimplePdfAdapter } from "./simple-pdf.adapter";
import { ImageStorageModule } from "../product-catalog/image-storage/image-storage.module";

@Module({
  imports: [ImageStorageModule],
  providers: [DocumentExportService, { provide: PDF_RENDERER, useClass: SimplePdfAdapter }],
  exports: [DocumentExportService],
})
export class DocumentExportModule {}
