const { Router } = require('express');
const {
  getAllAnniversaries,
  getAnniversaryById,
  createAnniversary,
  updateAnniversary,
  deleteAnniversary,
  getAnniversaryTimeline,
} = require('../controllers/anniversaryController');
const { authenticate, optionalAuthenticate, requireAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', optionalAuthenticate, getAllAnniversaries);
router.get('/timeline', optionalAuthenticate, getAnniversaryTimeline);
router.get('/:id', optionalAuthenticate, getAnniversaryById);
router.post('/', authenticate, requireAdmin, createAnniversary);
router.put('/:id', authenticate, requireAdmin, updateAnniversary);
router.delete('/:id', authenticate, requireAdmin, deleteAnniversary);

module.exports = router;

