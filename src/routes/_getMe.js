import User from '../models/User.js';
import StudentProfile from '../models/StudentProfile.js';

export default async function getMe(req, res) {
  const user = await User.findById(req.user._id).lean();
  const profile = await StudentProfile.findOne({ user: req.user._id }).lean();
  return res.json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    course: user.course,
    personalEmail: profile?.personalEmail || '',
    phone: profile?.phone || '',
    dob: profile?.dob || '',
    gender: profile?.gender || '',
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