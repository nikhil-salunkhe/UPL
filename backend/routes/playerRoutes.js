const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const { getPlayers, getAllPlayers, getPlayerImage, createPlayer, registerPlayer, approvePlayer, updatePlayer, deletePlayer } = require('../controllers/playerController');

router.get('/', getPlayers);
router.post('/register', upload.single('image'), registerPlayer);
router.get('/all', auth, getAllPlayers);
router.get('/:id/image', getPlayerImage);
router.post('/', auth, upload.single('image'), createPlayer);
router.patch('/:id/approve', auth, approvePlayer);
router.put('/:id', auth, upload.single('image'), updatePlayer);
router.delete('/:id', auth, deletePlayer);

module.exports = router;
