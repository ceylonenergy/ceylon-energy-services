/**
 * Where uploaded files go, behind one interface.
 *
 *   Images -> Cloudinary when configured (CDN, automatic WebP/AVIF,
 *             resizing on the fly), otherwise GridFS.
 *   PDFs   -> always GridFS (Cloudinary's free plan caps raw files at 10MB).
 *
 * Routes never talk to Cloudinary or GridFS directly; they save and
 * remove "assets" (see models/schemas/asset.js) and ask this module for
 * URLs. That is what lets the same code run with or without Cloudinary.
 */
const { env } = require('../../config/env');
const { cloudinary } = require('../../config/cloudinary');
const gridfs = require('./gridfs');

const providerOf = (asset) => asset?.provider || 'cloudinary';

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

/**
 * Store one image already validated by utils/fileType.inspectFile().
 * `folder` is relative, e.g. "completed-projects/loc-colombo/proj-x".
 */
async function saveImage(filePath, { folder, info, originalName = '' }) {
  if (env.storageDriver === 'cloudinary') {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `${env.cloudinary.baseFolder}/${folder}`,
      resource_type: 'image',
      unique_filename: true,
      overwrite: false,
    });
    return {
      provider: 'cloudinary',
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      mimeType: info.mime,
      originalName,
    };
  }

  const { fileId, bytes } = await gridfs.put(filePath, {
    filename: originalName || `image.${info.ext}`,
    contentType: info.mime,
    metadata: { folder },
  });
  return {
    provider: 'gridfs',
    fileId,
    url: `/api/files/${fileId}`,
    width: info.width,
    height: info.height,
    format: info.ext,
    bytes,
    mimeType: info.mime,
    originalName,
  };
}

/** Store a PDF (always GridFS). */
async function savePdf(filePath, { originalName = 'document.pdf', folder = 'documents' } = {}) {
  const { fileId, bytes } = await gridfs.put(filePath, {
    filename: originalName,
    contentType: 'application/pdf',
    metadata: { folder },
  });
  return {
    provider: 'gridfs',
    fileId,
    url: `/api/files/${fileId}`,
    format: 'pdf',
    bytes,
    mimeType: 'application/pdf',
    originalName,
  };
}

/**
 * Store several images with limited parallelism (Cloudinary's free tier
 * rate-limits bursts). If any upload fails, the ones that succeeded are
 * removed again, so a failed request never leaves orphaned files.
 */
async function saveImages(items, { concurrency = 3 } = {}) {
  const results = new Array(items.length);
  let next = 0;
  let failure = null;

  async function worker() {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await saveImage(items[index].path, items[index]);
      } catch (err) {
        failure = failure || err;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

  if (failure) {
    await removeAll(results.filter(Boolean));
    throw failure;
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Removing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Delete a stored file. Never throws: callers delete the database record
 * first, so a failure here leaves an orphaned file (harmless, logged)
 * rather than a broken image on the site.
 */
async function remove(asset) {
  if (!asset) return false;
  try {
    if (providerOf(asset) === 'gridfs') {
      if (asset.fileId) await gridfs.remove(asset.fileId);
      return true;
    }
    if (!asset.publicId) return false;
    if (!env.cloudinaryConfigured) {
      console.warn(`  Cloudinary is not configured, so ${asset.publicId} was left in Cloudinary.`);
      return false;
    }
    await cloudinary.uploader.destroy(asset.publicId, { resource_type: 'image' });
    return true;
  } catch (err) {
    console.warn(`  Could not delete stored file (${asset.publicId || asset.fileId}): ${err.message}`);
    return false;
  }
}

async function removeAll(assets) {
  for (const asset of assets) await remove(asset);
}

/* ------------------------------------------------------------------ */
/* URLs                                                                */
/* ------------------------------------------------------------------ */

/**
 * A resized/optimised URL for an image.
 *
 * Cloudinary builds sizes on the fly from the one stored original, so a
 * transformation is inserted into the stored URL. Working from the
 * stored URL (rather than rebuilding it from the configured cloud name)
 * keeps imported photos working even if the credentials change.
 *
 * GridFS stores one file and has no resizer, so every size is the same
 * URL — the admin panel shrinks large photos before uploading them.
 */
function variant(asset, transformation) {
  if (!asset?.url) return null;
  if (providerOf(asset) !== 'cloudinary' || !transformation) return asset.url;
  return asset.url.replace('/image/upload/', `/image/upload/${transformation}/`);
}

/** A URL that makes the browser save the file instead of opening it. */
function downloadUrl(asset, filename) {
  if (!asset?.url) return null;
  if (providerOf(asset) === 'gridfs') return `${asset.url}?download=1`;
  const safe = String(filename || 'download').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
  return asset.url.replace('/image/upload/', `/image/upload/fl_attachment:${safe}/`);
}

const SIZES = {
  thumb: 'c_fill,f_auto,q_auto,w_400,h_300',
  medium: 'c_limit,f_auto,q_auto,w_900',
  large: 'c_limit,f_auto,q_auto,w_1600',
  card: 'c_limit,f_auto,q_auto,w_700',
  pageThumb: 'c_limit,f_auto,q_auto,w_240',
};

module.exports = {
  saveImage,
  saveImages,
  savePdf,
  remove,
  removeAll,
  variant,
  downloadUrl,
  SIZES,
  driver: () => env.storageDriver,
};
