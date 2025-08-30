import mongoose from 'mongoose';

const educationSchema = new mongoose.Schema(
  {
    institute: String,
    board: String,
    joinYear: String, // year of joining
    passYear: String, // year passed out
    year: String, // legacy
    score: String,
  },
  { _id: false }
);

const documentsSchema = new mongoose.Schema(
  { aadhar: String, pan: String, caste: String, tenth: String, inter: String, degree: String, income: String },
  { _id: false }
);

const extraDocSchema = new mongoose.Schema(
  { name: String, path: String, uploadedAt: Date, size: Number, originalName: String },
  { _id: false }
);

const StudentProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    personalEmail: String,
    phone: String,
    dob: String,
    gender: String,
    bloodGroup: String,
    nationality: String,
    religion: String,
    address: String,
    schooling: { tenth: educationSchema, inter: educationSchema, degree: educationSchema },
    family: { father: String, mother: String, guardianContact: String, familyIncome: String },
    documents: documentsSchema,
    extraDocuments: [extraDocSchema],
    approvalStatus: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    approvalNote: String,
    approvalAt: Date,
    viewedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model('StudentProfile', StudentProfileSchema);