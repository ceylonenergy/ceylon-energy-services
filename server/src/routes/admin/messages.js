/** The contact-form inbox. */
const express = require('express');

const Message = require('../../models/Message');
const { messageOut } = require('../../services/serializers');
const v = require('../../utils/validate');
const { badRequest, notFound } = require('../../utils/httpError');

const router = express.Router();
const STATUSES = ['new', 'read', 'archived'];

router.get('/', async (req, res) => {
  const status = String(req.query.status || 'inbox');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

  // "inbox" = everything not archived.
  let filter = {};
  if (status === 'inbox') filter = { status: { $ne: 'archived' } };
  else if (STATUSES.includes(status)) filter = { status };
  else if (status !== 'all') throw badRequest('Unknown status filter.');

  const [messages, total, grouped] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Message.countDocuments(filter),
    Message.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of grouped) counts[g._id] = g.n;

  res.json({
    ok: true,
    messages: messages.map(messageOut),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts,
  });
});

router.patch('/:id', async (req, res) => {
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) throw badRequest('Status must be new, read or archived.');
  const msg = await Message.findByIdAndUpdate(
    v.objectId(req.params.id, 'Message'),
    { $set: { status } },
    { returnDocument: 'after' }
  ).lean();
  if (!msg) throw notFound('Message not found.');
  res.json({ ok: true, message: messageOut(msg) });
});

router.delete('/:id', async (req, res) => {
  const result = await Message.deleteOne({ _id: v.objectId(req.params.id, 'Message') });
  if (!result.deletedCount) throw notFound('Message not found.');
  res.json({ ok: true });
});

module.exports = router;
