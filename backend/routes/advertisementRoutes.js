const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const {
  getAdvertisements,
  getAllAdvertisements,
  getAdvertisementImage,
  createAdvertisement,
  updateAdvertisement,
  deleteAdvertisement
} = require('../controllers/advertisementController');

router.get('/', getAdvertisements);
router.get('/:id/image', getAdvertisementImage);
router.get('/all', auth, getAllAdvertisements);
router.post('/', auth, upload.single('banner'), createAdvertisement);
router.put('/:id', auth, upload.single('banner'), updateAdvertisement);
router.delete('/:id', auth, deleteAdvertisement);

module.exports = router;
