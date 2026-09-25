#!/usr/bin/env node
/**
 * Import the old site's content into MongoDB Atlas.
 *
 *   npm run seed                              gallery + company profile
 *   npm run seed -- --dry                     show what would happen, change nothing
 *   npm run seed -- --only=gallery            just the gallery   (or --only=profile)
 *   npm run seed -- --gallery-from-files      upload the original photo files
 *                                             instead of reusing the Cloudinary copies
 *
 * Safe to run any number of times: anything already imported is skipped,
 * and nothing you created in the admin panel is ever changed.
 *
 * Gallery: seed-data/projects.json lists the 51 photos the previous
 * backend already uploaded to Cloudinary. They are recorded as-is — no
 * upload, no duplicate copies. --gallery-from-files is the fallback for
 * when those Cloudinary copies are gone: it uploads the originals from
 * seed-data/completed-projects/ through the current storage (Cloudinary
 * or GridFS).
 *
 * Company profile: the 26MB PDF goes to GridFS, its 23 page images to
 * the current image storage.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { env, assertRequiredEnv } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const Location = require('../src/models/Location');
const Document = require('../src/models/Document');
const storage = require('../src/services/storage');
const { inspectFile } = require('../src/utils/fileType');
const { uniqueSlug } = require('../src/utils/slugify');

const SEED = path.resolve(__dirname, '../seed-data');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FROM_FILES = args.includes('--gallery-from-files');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1];

const PROFILE_SEED_KEY = 'legacy-company-profile';

const log = (...a) => console.log(' ', ...a);

/**
 * "https://res.cloudinary.com/<cloud>/image/upload/<transforms>/v1/<publicId>?_a=..."
 *   -> { publicId, url: "https://res.cloudinary.com/<cloud>/image/upload/v1/<publicId>" }
 */
function parseCloudinaryUrl(raw) {
  const match = /^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:.*?\/)?(v\d+)\/([^?#]+)/.exec(raw || '');
  if (!match) return null;
  const [, cloud, version, publicId] = match;
  return { publicId, url: `https://res.cloudinary.com/${cloud}/image/upload/${version}/${publicId}` };
}

/** Find a location by its old id, or start a new one. Existing names/order are never changed. */
async function ensureLocation(rawLoc, locIndex) {
  return (
    (await Location.findOne({ slug: rawLoc.id })) ||
    new Location({ slug: rawLoc.id, name: rawLoc.name, order: locIndex, projects: [] })
  );
}

function ensureProject(loc, rawProj, projIndex) {
  let proj = loc.projects.find((p) => p.slug === rawProj.id);
  if (!proj) {
    loc.projects.push({
      slug: rawProj.id || uniqueSlug('proj-', rawProj.name, loc.projects.map((p) => p.slug)),
      name: rawProj.name,
      order: projIndex,
      photos: [],
    });
    proj = loc.projects[loc.projects.length - 1];
  }
  return proj;
}

/* ------------------------------------------------------------------ */
/* Gallery from Cloudinary references                                  */
/* ------------------------------------------------------------------ */

async function seedGalleryFromCloudinary(stats) {
  const catalogue = JSON.parse(fs.readFileSync(path.join(SEED, 'projects.json'), 'utf8'));
  log(`Gallery: ${catalogue.length} locations in seed-data/projects.json (existing Cloudinary photos)\n`);

  for (const [locIndex, rawLoc] of catalogue.entries()) {
    log(rawLoc.name);
    const loc = DRY ? null : await ensureLocation(rawLoc, locIndex);

    for (const [projIndex, rawProj] of (rawLoc.projects || []).entries()) {
      const proj = DRY ? null : ensureProject(loc, rawProj, projIndex);

      let added = 0;
      let skipped = 0;
      for (const [photoIndex, rawPhoto] of (rawProj.photos || []).entries()) {
        const parsed = parseCloudinaryUrl(rawPhoto.large || rawPhoto.medium || rawPhoto.thumb);
        if (!parsed) {
          log(`     ! photo ${photoIndex + 1} has no recognisable Cloudinary URL, skipped`);
          stats.problems++;
          continue;
        }
        if (DRY) {
          added++;
          continue;
        }
        const already = proj.photos.some(
          (p) => p.publicId === parsed.publicId || (rawPhoto.id && String(p._id) === rawPhoto.id)
        );
        if (already) {
          skipped++;
          continue;
        }
        proj.photos.push({
          ...(mongoose.isValidObjectId(rawPhoto.id) ? { _id: rawPhoto.id } : {}),
          provider: 'cloudinary',
          publicId: parsed.publicId,
          url: parsed.url,
          caption: rawPhoto.caption || '',
          order: photoIndex,
        });
        added++;
      }
      stats.photos += added;
      stats.skipped += skipped;
      log(`   └─ ${rawProj.name}: ${added} ${DRY ? 'to import' : 'imported'}${skipped ? `, ${skipped} already there` : ''}`);
    }

    if (!DRY) await loc.save();
  }
}

/* ------------------------------------------------------------------ */
/* Gallery from the original files                                     */
/* ------------------------------------------------------------------ */

async function seedGalleryFromFiles(stats) {
  const catalogue = JSON.parse(fs.readFileSync(path.join(SEED, 'gallery.json'), 'utf8'));
  log(`Gallery: uploading original files through "${env.storageDriver}" storage\n`);

  for (const [locIndex, rawLoc] of catalogue.entries()) {
    log(rawLoc.name);
    const loc = DRY ? null : await ensureLocation(rawLoc, locIndex);
    for (const [projIndex, rawProj] of (rawLoc.projects || []).entries()) {
      const proj = DRY ? { photos: [] } : ensureProject(loc, rawProj, projIndex);
      let added = 0;
      let skipped = 0;

      for (const [photoIndex, relPath] of (rawProj.photos || []).entries()) {
        // The catalogue holds the old site paths; the files now live in seed-data.
        const filePath = path.join(SEED, relPath.replace(/^assets\/images\//, ''));
        if (!fs.existsSync(filePath)) {
          log(`     ! missing on disk: ${relPath}`);
          stats.problems++;
          continue;
        }
        if (proj.photos.some((p) => p.sourcePath === relPath)) {
          skipped++;
          continue;
        }
        if (DRY) {
          added++;
          continue;
        }
        const info = await inspectFile(filePath);
        const asset = await storage.saveImage(filePath, {
          folder: `completed-projects/${rawLoc.id}/${rawProj.id}`,
          info,
          originalName: path.basename(filePath),
        });
        proj.photos.push({ ...asset, sourcePath: relPath, order: photoIndex, caption: `${rawLoc.name} — ${rawProj.name}` });
        added++;
      }
      if (!DRY) await loc.save();
      stats.photos += added;
      stats.skipped += skipped;
      log(`   └─ ${rawProj.name}: ${added} ${DRY ? 'to upload' : 'uploaded'}${skipped ? `, ${skipped} already there` : ''}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Company profile                                                     */
/* ------------------------------------------------------------------ */

async function seedProfile(stats) {
  const dir = path.join(SEED, 'company-profile');
  const pdfPath = path.join(dir, 'Ceylon-Energy-Company-Profile.pdf');
  const pagePaths = fs
    .readdirSync(path.join(dir, 'pages'))
    .filter((f) => /^page-\d+\.jpe?g$/i.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10))
    .map((f) => path.join(dir, 'pages', f));

  const mb = (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(1);
  log(`\n  Company profile: ${mb}MB PDF + ${pagePaths.length} page images`);

  if (DRY) {
    log('   would upload the PDF to GridFS and the pages to', env.storageDriver);
    return;
  }
  if (await Document.exists({ seedKey: PROFILE_SEED_KEY })) {
    log('   already imported, skipped');
    return;
  }
  if (await Document.exists({ kind: 'profile' })) {
    log('   a Company Profile was already uploaded in the admin panel — left as it is');
    return;
  }

  log('   uploading PDF…');
  const pdf = await storage.savePdf(pdfPath, { originalName: path.basename(pdfPath), folder: 'documents/company-profile' });
  log(`   uploading ${pagePaths.length} pages…`);
  let pages;
  try {
    const items = [];
    for (const p of pagePaths) {
      items.push({ path: p, info: await inspectFile(p), originalName: path.basename(p), folder: 'documents/company-profile' });
    }
    pages = await storage.saveImages(items);
  } catch (err) {
    await storage.remove(pdf);
    throw err;
  }

  await Document.create({
    title: 'Company Profile',
    kind: 'profile',
    pdf,
    pages,
    originalName: path.basename(pdfPath),
    seedKey: PROFILE_SEED_KEY,
  });
  stats.profile = true;
  log('   done');
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n  Ceylon Energy — import existing content${DRY ? '  (DRY RUN — nothing is changed)' : ''}`);
  if (!DRY) {
    assertRequiredEnv();
    await connectDB();
    log(`Database "${env.dbName}", image storage: ${env.storageDriver}\n`);
  }

  const stats = { photos: 0, skipped: 0, problems: 0, profile: false };
  if (!ONLY || ONLY === 'gallery') {
    await (FROM_FILES ? seedGalleryFromFiles(stats) : seedGalleryFromCloudinary(stats));
  }
  if (!ONLY || ONLY === 'profile') await seedProfile(stats);

  console.log('\n  Summary');
  log(` Photos ${DRY ? 'to import' : 'imported'}: ${stats.photos}`);
  log(` Already there:   ${stats.skipped}`);
  if (stats.problems) log(` Problems:        ${stats.problems} (see above)`);
  if (!DRY && (!ONLY || ONLY === 'profile')) log(` Company profile: ${stats.profile ? 'imported' : 'unchanged'}`);
  console.log(DRY ? '\n  Run without --dry to do it for real.\n' : '\n  Next: npm run create-admin  (if you have not yet)\n');

  if (!DRY) await disconnectDB();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('\n  Import failed:', err.message);
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
}

module.exports = { parseCloudinaryUrl };
