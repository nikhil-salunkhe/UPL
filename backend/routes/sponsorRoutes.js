const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { getSponsors, createSponsor, updateSponsor, deleteSponsor } = require('../controllers/sponsorController');

router.get('/', getSponsors);
router.post('/', auth, upload.single('logo'), createSponsor);
router.put('/:id', auth, upload.single('logo'), updateSponsor);
router.delete('/:id', auth, deleteSponsor);

module.exports = router;
