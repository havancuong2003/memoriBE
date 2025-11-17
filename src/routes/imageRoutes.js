const { Router } = require('express');
const {
  getAllImages,
  getImageById,
  uploadImages,
  updateImage,
  deleteImage,
  moveImage,
  reactToImage,
  addLoveNote,
  getTimeline,
  getTodayInPast,
  getAnniversaryTimeline,
} = require('../controllers/imageController');
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const router = Router();

router.get('/', optionalAuthenticate, getAllImages);
router.get('/timeline', optionalAuthenticate, getTimeline);
router.get('/timeline/anniversary', optionalAuthenticate, getAnniversaryTimeline);
router.get('/today-in-past', optionalAuthenticate, getTodayInPast);
router.get('/:id', optionalAuthenticate, getImageById);
router.post('/', authenticate, requireAdmin, upload.fields([{ name: 'images', maxCount: 100 }]), uploadImages);
router.put('/:id', authenticate, requireAdmin, updateImage);
router.put('/:id/move', authenticate, requireAdmin, moveImage);
router.delete('/:id', authenticate, requireAdmin, deleteImage);
router.post('/:id/react', reactToImage);
router.post('/:id/love-note', addLoveNote);

module.exports = router;


