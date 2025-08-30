import bcrypt from 'bcryptjs';
import User from './models/User.js';
import StudentProfile from './models/StudentProfile.js';

export async function ensureAdmin() {
  const email = 'mitsstaff01@mits.ac.in';
  const password = 'Staff@123';
  let user = await User.findOne({ email });
  const hash = await bcrypt.hash(password, 10);
  if (!user) {
    user = await User.create({ name: 'MITS Staff', email, password: hash, role: 'admin', course: 'MCA' });
    await StudentProfile.create({ user: user._id, approvalStatus: 'pending' });
    console.log('Seeded admin account:', email);
  } else {
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin', password: hash } });
    console.log('Ensured admin account:', email);
  }
}