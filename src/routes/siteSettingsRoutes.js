const { Router } = require('express');
const {
  getSettings,
  updateBackground,
  deleteBackground,
} = require('../controllers/siteSettingsController');
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const router = Router();

router.get('/', optionalAuthenticate, getSettings);
router.post('/background', authenticate, requireAdmin, upload.single('image'), updateBackground);
router.delete('/background', authenticate, requireAdmin, deleteBackground);

module.exports = router;

