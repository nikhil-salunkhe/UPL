const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { getOwners, createOwner, updateOwner, deleteOwner } = require('../controllers/ownerController');

router.get('/', getOwners);
router.post('/', auth, upload.single('image'), createOwner);
router.put('/:id', auth, upload.single('image'), updateOwner);
router.delete('/:id', auth, deleteOwner);

module.exports = router;
