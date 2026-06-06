import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';

export interface UploadedImage {
  url: string;
  thumbnailUrl: string | null;
  fileId: string;
}

/**
 * Server-side proxy to ImageKit. The frontend uploads files to our API as
 * multipart/form-data; we forward them to ImageKit using the private key so
 * credentials never leave the backend.
 */
@Injectable()
export class ImageKitService {
  private readonly logger = new Logger(ImageKitService.name);
  private readonly imagekit: ImageKit;
  private readonly folder: string;

  constructor(private readonly config: ConfigService) {
    this.imagekit = new ImageKit({
      publicKey: this.config.get<string>('imagekit.publicKey') as string,
      privateKey: this.config.get<string>('imagekit.privateKey') as string,
      urlEndpoint: this.config.get<string>('imagekit.urlEndpoint') as string,
    });
    this.folder = this.config.get<string>('imagekit.folder') as string;
  }

  async uploadMany(files: Express.Multer.File[]): Promise<UploadedImage[]> {
    const uploads = files.map((file) =>
      this.imagekit.upload({
        file: file.buffer,
        fileName: file.originalname,
        folder: this.folder,
        useUniqueFileName: true,
      }),
    );
    const results = await Promise.all(uploads);
    return results.map((r) => ({
      url: r.url,
      thumbnailUrl: r.thumbnailUrl ?? null,
      fileId: r.fileId,
    }));
  }

  /** Best-effort deletion; logs but does not throw on failure. */
  async deleteMany(fileIds: string[]): Promise<void> {
    await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          await this.imagekit.deleteFile(fileId);
        } catch (err) {
          this.logger.error(
            `Failed to delete ImageKit file ${fileId}`,
            err as Error,
          );
        }
      }),
    );
  }
}
