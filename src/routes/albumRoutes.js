const { Router } = require('express');
const {
  getAllAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  updateCoverImage,
} = require('../controllers/albumController');
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const router = Router();

router.get('/', optionalAuthenticate, getAllAlbums);
router.get('/:id', optionalAuthenticate, getAlbumById);
router.post('/', authenticate, requireAdmin, createAlbum);
router.put('/:id', authenticate, requireAdmin, updateAlbum);
router.put('/:id/cover', authenticate, requireAdmin, upload.single('coverImage'), updateCoverImage);
router.delete('/:id', authenticate, requireAdmin, deleteAlbum);

module.exports = router;


