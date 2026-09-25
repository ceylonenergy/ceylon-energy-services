/**
 * Identify an uploaded file by its first bytes, never by its name or the
 * browser's claimed type — anything can be renamed to "photo.jpg". This
 * is what PHP's finfo_file() did in the old admin panel.
 *
 * Also reads pixel dimensions straight from the image header, so images
 * stored in GridFS carry width/height without an image-processing
 * dependency.
 */
const fs = require('fs/promises');

const TYPES = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
  webp: { mime: 'image/webp', ext: 'webp' },
  pdf: { mime: 'application/pdf', ext: 'pdf' },
};

function detect(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'pdf';
  return null;
}

function pngSize(buf) {
  // IHDR is always the first chunk: width and height are big-endian at 16 and 20.
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF0..SOF15 carry the frame size, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // markers without a length field
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

function webpSize(buf) {
  if (buf.length < 30) return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  return null;
}

/**
 * Inspect a file on disk. Returns `{ kind, mime, ext, width, height }`
 * or `null` when the bytes are not one of the accepted formats.
 */
async function inspectFile(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    // 64KB comfortably covers JPEG headers with large EXIF blocks.
    const buf = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    const head = buf.subarray(0, bytesRead);
    const kind = detect(head);
    if (!kind) return null;

    let size = null;
    if (kind === 'png') size = pngSize(head);
    if (kind === 'jpeg') size = jpegSize(head);
    if (kind === 'webp') size = webpSize(head);

    return { kind, ...TYPES[kind], width: size?.width, height: size?.height };
  } finally {
    await handle.close();
  }
}

const IMAGE_KINDS = ['jpeg', 'png', 'webp'];

module.exports = { inspectFile, detect, IMAGE_KINDS };
