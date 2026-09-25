/** Admin accounts. The PHP panel had one shared password; this allows one login per person. */
const express = require('express');

const Admin = require('../../models/Admin');
const v = require('../../utils/validate');
const { badRequest, conflict, notFound } = require('../../utils/httpError');

const router = express.Router();

router.get('/', async (req, res) => {
  const admins = await Admin.find().sort({ createdAt: 1 });
  res.json({ ok: true, users: admins.map((a) => ({ ...a.toPublic(), isYou: a._id.equals(req.admin._id) })) });
});

router.post('/', async (req, res) => {
  const email = v.email(req.body?.email);
  if (await Admin.exists({ email })) throw conflict('An admin with that email already exists.');

  const admin = new Admin({ email, name: v.text(req.body?.name, { label: 'Name', max: 100 }) });
  await admin.setPassword(v.password(req.body?.password));
  await admin.save();
  res.status(201).json({ ok: true, user: admin.toPublic() });
});

router.delete('/:id', async (req, res) => {
  const id = v.objectId(req.params.id, 'Admin');
  if (req.admin._id.equals(id)) throw badRequest('You cannot remove your own account while logged in with it.');
  if ((await Admin.countDocuments()) <= 1) throw badRequest('The last admin account cannot be removed.');

  const result = await Admin.deleteOne({ _id: id });
  if (!result.deletedCount) throw notFound('Admin not found.');
  res.json({ ok: true });
});

module.exports = router;
