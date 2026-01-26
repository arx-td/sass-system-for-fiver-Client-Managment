import { Injectable, BadRequestException } from '@nestjs/common';
import { join, extname } from 'path';
import { existsSync, unlinkSync } from 'fs';

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

  processUploadedFile(file: Express.Multer.File): UploadedFile {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Build the URL path
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

  processMultipleFiles(files: Express.Multer.File[]): UploadedFile[] {
    if (!files || files.length === 0) {
      return [];
    }

    return files.map((file) => this.processUploadedFile(file));
  }

  deleteFile(fileUrl: string): boolean {
    try {
      // Extract the relative path from the URL
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
