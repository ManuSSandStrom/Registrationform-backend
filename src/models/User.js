import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    course: { type: String, enum: ['MCA', 'MBA'], required: true },
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);