import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

// Check if Cloudinary is configured
const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

// Ensure upload directory exists (for local storage fallback)
const uploadDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

// File filter for allowed types
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain',
    'text/csv',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

@Module({
  imports: [
    MulterModule.register({
      // Use memory storage for Cloudinary, disk storage for local
      storage: useCloudinary
        ? memoryStorage()
        : diskStorage({
            destination: (req, file, cb) => {
              const dateDir = new Date().toISOString().split('T')[0];
              const targetDir = join(uploadDir, dateDir);
              if (!existsSync(targetDir)) {
                mkdirSync(targetDir, { recursive: true });
              }
              cb(null, targetDir);
            },
            filename: (req, file, cb) => {
              const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
              const ext = extname(file.originalname);
              cb(null, `${uniqueSuffix}${ext}`);
            },
          }),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
      },
      fileFilter,
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
