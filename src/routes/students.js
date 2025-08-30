import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import StudentProfile from '../models/StudentProfile.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

export async function getProfile(req, res) {
  const user = await User.findById(req.user._id).lean();
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();
  return res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    course: user.course,
    personalEmail: profile?.personalEmail || '',
    phone: profile?.phone || '',
    dob: profile?.dob || '',
    gender: profile?.gender || '',
    bloodGroup: profile?.bloodGroup || '',
    nationality: profile?.nationality || '',
    religion: profile?.religion || '',
    address: profile?.address || '',
    schooling: profile?.schooling || {},
    family: profile?.family || {},
    documents: profile?.documents || {},
    extraDocuments: profile?.extraDocuments || [],
    approvalStatus: profile?.approvalStatus || 'pending',
    approvalNote: profile?.approvalNote || '',
    approvalAt: profile?.approvalAt || null,
  });
}

router.get('/me', getProfile);

router.put('/me', async (req, res) => {
  const body = req.body || {};
  const { personal = {}, schooling = {}, family = {} } = body;
  const college = (personal?.email || '').trim();
  if (college && !/^[a-f0-9]{10}@mits\.ac\.in$/i.test(college)) {
    return res.status(400).json({ error: 'College email must be 10 hex characters + @mits.ac.in (e.g., 24691f00e3@mits.ac.in)' });
  }
  const fullName = (personal?.name || '').trim();
  if (fullName && !/^[A-Za-z]+(?: [A-Za-z]+)+$/.test(fullName)) {
    return res.status(400).json({ error: 'Enter full name (first and last), letters only' });
  }

  await User.updateOne(
    { _id: req.user._id },
    { $set: { name: personal.name ?? undefined, email: personal.email ?? undefined, course: personal.course ?? undefined } }
  );
  const update = {
    personalEmail: personal.personalEmail,
    phone: personal.phone,
    dob: personal.dob,
    gender: personal.gender,
    bloodGroup: personal.bloodGroup,
    nationality: personal.nationality,
    religion: personal.religion,
    address: personal.address,
    schooling,
    family,
    approvalStatus: 'pending',
    approvalNote: '',
    approvalAt: null,
  };
  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: update },
    { upsert: true, new: true }
  );
  res.json({ ok: true, profile });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage });

router.post('/me/documents', upload.fields([
  { name: 'aadhar', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'caste', maxCount: 1 },
  { name: 'tenth', maxCount: 1 },
  { name: 'inter', maxCount: 1 },
  { name: 'degree', maxCount: 1 },
  { name: 'income', maxCount: 1 },
]), async (req, res) => {
  const files = req.files || {};
  const map = {};
  for (const key of ['aadhar','pan','caste','tenth','inter','degree','income']) {
    const f = files[key]?.[0];
    if (f) map[`documents.${key}`] = `/${(process.env.UPLOAD_DIR || 'uploads')}/${f.filename}`.replace(/\\/g, '/');
  }
  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $set: { ...map, approvalStatus: 'pending', approvalNote: '', approvalAt: null } },
    { upsert: true, new: true }
  );
  res.json({ ok: true, documents: profile.documents });
});

router.delete('/me/documents', async (req, res) => {
  const key = String(req.query.key || '').trim();
  const allowed = ['aadhar','pan','caste','tenth','inter','degree','income'];
  if (!allowed.includes(key)) return res.status(400).json({ error: 'Invalid key' });
  const prof = await StudentProfile.findOne({ user: req.user._id });
  const currentPath = prof?.documents?.[key];
  const field = 'documents.' + key;
  const updated = await StudentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $unset: { [field]: '' }, $set: { approvalStatus: 'pending', approvalNote: '', approvalAt: null } },
    { new: true, upsert: true }
  );
  try {
    if (currentPath) {
      const disk = path.resolve(currentPath.startsWith('/') ? '.' + currentPath : currentPath);
      await fs.unlink(disk).catch(()=>{});
    }
  } catch {}
  return res.json({ ok: true, documents: updated.documents });
});

router.post('/me/attachments', upload.array('extras'), async (req, res) => {
  const namesRaw = req.body?.names;
  const files = req.files || [];
  const names = Array.isArray(namesRaw) ? namesRaw : (namesRaw ? [namesRaw] : []);
  const docs = files.map((f, i) => ({
    name: names[i] || f.originalname || 'Attachment',
    path: `/${(process.env.UPLOAD_DIR || 'uploads')}/${f.filename}`.replace(/\\/g, '/'),
    uploadedAt: new Date(),
    size: f.size,
    originalName: f.originalname,
  }));
  if (!docs.length) return res.status(400).json({ error: 'No files' });
  await StudentProfile.updateOne(
    { user: req.user._id },
    { $push: { extraDocuments: { $each: docs } }, $set: { approvalStatus: 'pending', approvalNote: '', approvalAt: null } },
    { upsert: true }
  );
  res.json({ ok: true, added: docs });
});

router.delete('/me/attachments', async (req, res) => {
  const pth = req.query.path;
  if (!pth) return res.status(400).json({ error: 'Missing path' });
  const prof = await StudentProfile.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { extraDocuments: { path: pth } }, $set: { approvalStatus: 'pending', approvalNote: '', approvalAt: null } },
    { new: true }
  );
  try {
    const diskPath = path.resolve(pth.startsWith('/') ? '.' + pth : pth);
    await fs.unlink(diskPath).catch(()=>{});
  } catch {}
  res.json({ ok: true, extraDocuments: prof?.extraDocuments || [] });
});

export default router;