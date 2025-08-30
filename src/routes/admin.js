import { Router } from 'express';
import { auth, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import { notifyApproval } from '../utils/notify.js';

const router = Router();
router.use(auth, requireAdmin);

// List with filters + counts
router.get('/students', async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
  const search = (req.query.search || '').trim();
  const status = (req.query.status || '').trim();
  const q = search
    ? { $or: [ { name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } } ] }
    : {};
  const users = await User.find({ role: 'student', ...q })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('name email course')
    .lean();
  const ids = users.map(u=>u._id);
  const profsArr = await StudentProfile.find({ user: { $in: ids } }).select('user approvalStatus viewedAt').lean();
  const profs = new Map(profsArr.map(p=>[String(p.user), p]));
  let items = users.map(u=>({ ...u, approvalStatus: (profs.get(String(u._id))||{}).approvalStatus || 'pending', viewedAt: (profs.get(String(u._id))||{}).viewedAt || null }));
  if (status === 'viewed') items = items.filter(x=>!!x.viewedAt);
  if (['pending','approved','rejected'].includes(status)) items = items.filter(x=>x.approvalStatus===status);
  const [pending, approved, rejected, viewed] = await Promise.all([
    StudentProfile.countDocuments({ approvalStatus: 'pending' }),
    StudentProfile.countDocuments({ approvalStatus: 'approved' }),
    StudentProfile.countDocuments({ approvalStatus: 'rejected' }),
    StudentProfile.countDocuments({ viewedAt: { $ne: null } }),
  ]);
  res.json({ items, counts: { pending, approved, rejected, viewed } });
});

// Detail: mark as viewed
router.get('/students/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) return res.status(404).json({ error: 'Not found' });
  await StudentProfile.updateOne({ user: user._id }, { $set: { viewedAt: new Date() } }, { upsert: true });
  const profile = await StudentProfile.findOne({ user: user._id }).lean();
  res.json({ ...user, profile });
});

// Approve/Reject
router.patch('/students/:id/approval', async (req, res) => {
  const { status = 'approved', note = '' } = req.body || {};
  if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status==='rejected' && (!note || !note.trim())) return res.status(400).json({ error: 'Rejection requires a note' });
  const profile = await StudentProfile.findOneAndUpdate(
    { user: req.params.id },
    { $set: { approvalStatus: status, approvalNote: note, approvalAt: new Date() } },
    { new: true, upsert: true }
  );
  try { const user = await User.findById(req.params.id).lean(); await notifyApproval(user, profile); } catch {}
  res.json({ ok: true, approvalStatus: profile.approvalStatus, approvalNote: profile.approvalNote, approvalAt: profile.approvalAt });
});

export default router;