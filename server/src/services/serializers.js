/**
 * Turn stored documents into what the browser needs. Every image
 * arrives with ready-to-use URLs, so the React app never has to know
 * whether a file lives in Cloudinary or GridFS.
 *
 * `admin: true` adds the fields only the admin panel uses (hidden
 * items, ordering, storage details).
 */
const { variant, downloadUrl, SIZES } = require('./storage');

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const isPublished = (item) => item.published !== false;

function photoOut(photo) {
  return {
    id: String(photo._id),
    caption: photo.caption || '',
    width: photo.width ?? null,
    height: photo.height ?? null,
    thumb: variant(photo, SIZES.thumb),
    medium: variant(photo, SIZES.medium),
    large: variant(photo, SIZES.large),
  };
}

function projectOut(proj, { admin = false } = {}) {
  const photos = [...(proj.photos || [])].sort(byOrder).map(photoOut);
  return {
    id: String(proj._id),
    slug: proj.slug,
    name: proj.name,
    description: proj.description || '',
    photoCount: photos.length,
    cover: photos[0] || null,
    photos,
    ...(admin ? { published: isPublished(proj) } : {}),
  };
}

/** Same public shape the previous gallery API returned, so older clients keep working. */
function locationOut(loc, { admin = false } = {}) {
  const projects = [...(loc.projects || [])]
    .filter((p) => admin || isPublished(p))
    .sort(byOrder)
    .map((p) => projectOut(p, { admin }))
    // Visitors never see an empty project: its card would open a blank grid.
    .filter((p) => admin || p.photoCount > 0);

  return {
    id: String(loc._id),
    slug: loc.slug,
    name: loc.name,
    projectCount: projects.length,
    photoCount: projects.reduce((sum, p) => sum + p.photoCount, 0),
    cover: projects.find((p) => p.cover)?.cover || null,
    projects,
    ...(admin ? { published: isPublished(loc) } : {}),
  };
}

function awardOut(award, { admin = false } = {}) {
  return {
    id: String(award._id),
    title: award.title,
    year: award.year || null,
    image: {
      card: variant(award.image, SIZES.card),
      large: variant(award.image, SIZES.large),
      width: award.image?.width ?? null,
      height: award.image?.height ?? null,
    },
    createdAt: award.createdAt,
    ...(admin ? { published: isPublished(award), order: award.order ?? 0 } : {}),
  };
}

function documentOut(doc, { admin = false } = {}) {
  const pages = (doc.pages || []).map((page, i) => ({
    full: variant(page, SIZES.large),
    card: variant(page, SIZES.card),
    thumb: variant(page, SIZES.pageThumb),
    download: downloadUrl(page, `${doc.title}-page-${String(i + 1).padStart(2, '0')}`),
  }));

  return {
    id: String(doc._id),
    title: doc.title,
    kind: doc.kind,
    pageCount: pages.length,
    cover: pages[0] || null,
    pages,
    pdf: {
      url: doc.pdf?.url || null,
      download: downloadUrl(doc.pdf, doc.title),
      bytes: doc.pdf?.bytes ?? null,
    },
    updatedAt: doc.updatedAt,
    ...(admin
      ? {
          published: isPublished(doc),
          order: doc.order ?? 0,
          originalName: doc.originalName || '',
          createdAt: doc.createdAt,
          archivedAt: doc.archivedAt || null,
        }
      : {}),
  };
}

function messageOut(msg) {
  return {
    id: String(msg._id),
    name: msg.name,
    email: msg.email,
    phone: msg.phone || '',
    subject: msg.subject || '',
    message: msg.message,
    status: msg.status,
    delivery: {
      status: msg.delivery?.status || 'pending',
      error: msg.delivery?.error || '',
    },
    createdAt: msg.createdAt,
  };
}

module.exports = { photoOut, projectOut, locationOut, awardOut, documentOut, messageOut, byOrder, isPublished };
