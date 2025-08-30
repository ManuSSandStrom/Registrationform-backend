import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';
import { signToken } from '../utils/jwt.js';
import { auth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  let { name, email, password, course } = req.body || {};
  name = (name || '').toString().trim();
  email = (email || '').toString().trim().toLowerCase();
  password = (password || '').toString();
  course = (course || '').toString().trim();
  if (!name || !email || !password || !course) return res.status(400).json({ error: 'Missing fields' });
  if (!/[A-Za-z]+(?: [A-Za-z]+)+/.test(name)) return res.status(400).json({ error: 'Enter full name' });
  if (!/^[\w.+-]+@gmail\.com$/.test(email)) return res.status(400).json({ error: 'Email must be Gmail' });
  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash, course, role: 'student' });
  await StudentProfile.create({ user: user._id });
  const token = signToken({ id: user._id, role: user.role });
  res.json({ token, role: user.role, user: { id: user._id, name: user.name, email: user.email } });
});

router.post('/login', async (req, res) => {
  let { email, password } = req.body || {};
  email = (email || '').toString().trim().toLowerCase();
  password = (password || '').toString();
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ id: user._id, role: user.role });
  res.json({ token, role: user.role, user: { id: user._id, name: user.name, email: user.email } });
});

// Also allow /api/auth/me so either path works
router.get('/me', auth, async (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }, course: req.user.course });
});

export default router;
