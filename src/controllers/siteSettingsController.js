const SiteSettings = require('../models/SiteSettings');
const { upload } = require('../config/cloudinary');

// Get site settings
const getSettings = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// Update background image
const updateBackground = async (req, res, next) => {
  try {
    if (!req.file) {
      const error = new Error('Vui lòng upload ảnh');
      error.statusCode = 400;
      throw error;
    }

    const settings = await SiteSettings.getSettings();
    settings.backgroundImageUrl = req.file.secure_url;
    settings.backgroundImage = req.file.secure_url;
    settings.updatedBy = req.user.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Đã cập nhật background thành công',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// Delete background (reset về mặc định)
const deleteBackground = async (req, res, next) => {
  try {
    const settings = await SiteSettings.getSettings();
    settings.backgroundImage = null;
    settings.backgroundImageUrl = null;
    settings.updatedBy = req.user.userId;
    await settings.save();

    res.json({
      success: true,
      message: 'Đã xóa background, trở về mặc định',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateBackground,
  deleteBackground,
};

