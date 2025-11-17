const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const albumRoutes = require('./routes/albumRoutes');
const imageRoutes = require('./routes/imageRoutes');
const anniversaryRoutes = require('./routes/anniversaryRoutes');
const siteSettingsRoutes = require('./routes/siteSettingsRoutes');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

// Load env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/anniversaries', anniversaryRoutes);
app.use('/api/site-settings', siteSettingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server đang chạy tốt!' });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Khởi tạo admin và user đặc biệt (Cường và Linh)
const initUsers = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@123';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

    // Tạo admin
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
      });
      console.log(`✅ Đã tạo admin account: ${adminEmail} / ${adminPassword}`);
    }

    // Tạo account cho Cường
    const cuongEmail = 'cuong@123.com';
    const cuongPassword = 'cuong123456';
    const existingCuong = await User.findOne({ email: cuongEmail });
    if (!existingCuong) {
      const hashedPassword = await bcrypt.hash(cuongPassword, 10);
      await User.create({
        email: cuongEmail,
        password: hashedPassword,
        role: 'viewer', // Viewer nhưng có quyền đặc biệt
      });
      console.log(`✅ Đã tạo account cho Cường: ${cuongEmail} / ${cuongPassword}`);
    }

    // Tạo account cho Linh
    const linhEmail = 'linh@123.com';
    const linhPassword = 'linh123456';
    const existingLinh = await User.findOne({ email: linhEmail });
    if (!existingLinh) {
      const hashedPassword = await bcrypt.hash(linhPassword, 10);
      await User.create({
        email: linhEmail,
        password: hashedPassword,
        role: 'viewer', // Viewer nhưng có quyền đặc biệt
      });
      console.log(`✅ Đã tạo account cho Linh: ${linhEmail} / ${linhPassword}`);
    }
  } catch (error) {
    console.error('Lỗi khi tạo users:', error);
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await initUsers();

    app.listen(PORT, () => {
      console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
      console.log(`📝 API docs: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Lỗi khi khởi động server:', error);
    process.exit(1);
  }
};

startServer();


