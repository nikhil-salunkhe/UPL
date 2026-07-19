const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { getPlayers, createPlayer, updatePlayer, deletePlayer } = require('../controllers/playerController');

router.get('/', getPlayers);
router.post('/', auth, upload.single('image'), createPlayer);
router.put('/:id', auth, upload.single('image'), updatePlayer);
router.delete('/:id', auth, deletePlayer);

module.exports = router;
