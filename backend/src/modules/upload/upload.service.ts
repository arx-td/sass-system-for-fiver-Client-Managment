import { Injectable, BadRequestException } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedFile {
  url: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class UploadService {
  private readonly baseUrl = process.env.BACKEND_URL || 'http://localhost:4000';
  private readonly useCloudinary: boolean;

  constructor() {
    // Configure Cloudinary if credentials are provided
    this.useCloudinary = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      console.log('[UPLOAD] Cloudinary configured successfully');
    } else {
      console.log('[UPLOAD] Using local file storage (Cloudinary not configured)');
    }
  }

  async processUploadedFile(file: Express.Multer.File): Promise<UploadedFile> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // If Cloudinary is configured, upload to cloud
    if (this.useCloudinary) {
      return this.uploadToCloudinary(file);
    }

    // Fallback to local storage
    const dateDir = new Date().toISOString().split('T')[0];
    const relativePath = `/uploads/${dateDir}/${file.filename}`;

    return {
      url: `${this.baseUrl}${relativePath}`,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  private async uploadToCloudinary(file: Express.Multer.File): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'codereve',
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('[CLOUDINARY] Upload error:', error);
            reject(new BadRequestException('Failed to upload file to cloud storage'));
          } else {
            resolve({
              url: result.secure_url,
              fileName: result.public_id,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
            });
          }
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async processMultipleFiles(files: Express.Multer.File[]): Promise<UploadedFile[]> {
    if (!files || files.length === 0) {
      return [];
    }

    const results = await Promise.all(
      files.map((file) => this.processUploadedFile(file))
    );
    return results;
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      // If it's a Cloudinary URL, delete from Cloudinary
      if (fileUrl.includes('cloudinary.com')) {
        const publicId = this.extractCloudinaryPublicId(fileUrl);
        if (publicId) {
          await cloudinary.uploader.destroy(publicId);
          return true;
        }
      }

      // Fallback to local file deletion
      const urlPath = new URL(fileUrl).pathname;
      const filePath = join(process.cwd(), urlPath);

      if (existsSync(filePath)) {
        unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete file:', error);
      return false;
    }
  }

  private extractCloudinaryPublicId(url: string): string | null {
    try {
      const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  getFileExtension(filename: string): string {
    return extname(filename).toLowerCase();
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isPdf(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  isDocument(mimeType: string): boolean {
    const docTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];
    return docTypes.includes(mimeType);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
