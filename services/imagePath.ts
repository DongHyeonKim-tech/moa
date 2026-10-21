import { AppDataError } from '@/services/dataError';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') {
    return 'png';
  }
  if (mimeType === 'image/webp') {
    return 'webp';
  }
  if (mimeType === 'image/gif') {
    return 'gif';
  }
  return 'jpg';
}

export function assertAllowedImage(mimeType: string, size: number | null): void {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new AppDataError('jpeg, png, webp, gif 이미지만 넣을 수 있어요.');
  }
  if (size !== null && size > MAX_IMAGE_BYTES) {
    throw new AppDataError('사진은 10MB 이하만 넣을 수 있어요.');
  }
}

export function imageStoragePath(userId: string, fileId: string, mimeType: string): string {
  return `${userId}/${fileId}.${extensionForMime(mimeType)}`;
}
