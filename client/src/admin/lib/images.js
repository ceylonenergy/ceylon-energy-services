/**
 * Shrink big photos in the browser before uploading them.
 *
 * A modern phone photo is 4000px+ and several MB, while the website
 * never shows anything wider than 1600px. Resizing here makes uploads
 * several times faster on a slow connection and keeps every file under
 * the server's 10MB limit. PNGs are left alone (they may be logos or
 * certificates with transparency); so are images already small enough.
 */
const MAX_EDGE = 2560;
const QUALITY = 0.88;

export async function shrinkImage(file) {
  if (!/^image\/(jpeg|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // the server will say if it really is not an image
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_EDGE) {
    bitmap.close?.();
    return file;
  }

  const scale = MAX_EDGE / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
