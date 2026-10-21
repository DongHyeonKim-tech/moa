import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { createId } from '@/utils/id';

export type StoredImage = {
  id: string;
  localUri: string;
  mimeType: string;
  fileName: string;
};

export async function pickAndStoreImage(): Promise<StoredImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    return null;
  }

  const id = createId();
  const extension = extensionFor(asset.mimeType, asset.fileName, asset.uri);
  const directory = new Directory(Paths.document, 'moa-attachments');
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  const destination = new File(directory, `${id}${extension}`);
  const source = new File(asset.uri);
  await source.copy(destination);

  return {
    id,
    localUri: destination.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    fileName: destination.name,
  };
}

export function deleteAttachmentFile(localUri: string): void {
  try {
    const file = new File(localUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // 이미 없는 파일이면 메모 데이터만 정리하면 된다.
  }
}

function extensionFor(mimeType: string | undefined, fileName: string | null | undefined, uri: string): string {
  if (mimeType === 'image/png') {
    return '.png';
  }
  if (mimeType === 'image/webp') {
    return '.webp';
  }
  if (mimeType === 'image/gif') {
    return '.gif';
  }
  const name = fileName ?? uri;
  const match = /\.(png|webp|gif|jpe?g)$/i.exec(name);
  if (match?.[1]) {
    return `.${match[1].toLowerCase()}`;
  }
  return '.jpg';
}
