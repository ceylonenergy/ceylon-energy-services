/**
 * Everything under /api/admin requires a logged-in admin, and every
 * write additionally requires the admin request header (CSRF guard).
 */
const express = require('express');

const Location = require('../../models/Location');
const Award = require('../../models/Award');
const Document = require('../../models/Document');
const Message = require('../../models/Message');
const { requireAuth, requireAdminHeader } = require('../../middleware/auth');
const { env } = require('../../config/env');
const { dbState } = require('../../config/db');
const { mailMode } = require('../../services/mailer');

const router = express.Router();

router.use(requireAdminHeader, requireAuth);
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

/** Dashboard numbers and a plain-language system status. */
router.get('/stats', async (req, res) => {
  const [gallery] = await Location.aggregate([
    {
      $project: {
        projects: { $size: { $ifNull: ['$projects', []] } },
        photos: {
          $sum: {
            $map: { input: { $ifNull: ['$projects', []] }, as: 'p', in: { $size: { $ifNull: ['$$p.photos', []] } } },
          },
        },
      },
    },
    { $group: { _id: null, locations: { $sum: 1 }, projects: { $sum: '$projects' }, photos: { $sum: '$photos' } } },
  ]);

  const [awards, documents, newMessages, profile] = await Promise.all([
    Award.countDocuments(),
    Document.countDocuments({ kind: 'attachment' }),
    Message.countDocuments({ status: 'new' }),
    Document.findOne({ kind: 'profile' }, { pages: 1, updatedAt: 1 }).lean(),
  ]);

  res.json({
    ok: true,
    counts: {
      locations: gallery?.locations || 0,
      projects: gallery?.projects || 0,
      photos: gallery?.photos || 0,
      awards,
      documents,
      newMessages,
      profilePages: profile?.pages?.length || 0,
    },
    system: {
      mongo: dbState(),
      storage: env.storageDriver,
      cloudinary: env.cloudinaryConfigured,
      mail: mailMode(),
      mailTo: env.mail.to,
      nodeEnv: env.nodeEnv,
    },
  });
});

router.use('/gallery', require('./gallery'));
router.use('/awards', require('./awards'));
router.use('/documents', require('./documents'));
router.use('/messages', require('./messages'));
router.use('/users', require('./users'));

module.exports = router;
