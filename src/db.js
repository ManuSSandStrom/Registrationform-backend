import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/student_portal';

mongoose.set('strictQuery', true);
mongoose
  .connect(uri)
  .then(() => console.log('MongoDB connected'))
  .catch((e) => {
    console.error('MongoDB connection error:', e.message);
    process.exit(1);
  });

export default mongoose;