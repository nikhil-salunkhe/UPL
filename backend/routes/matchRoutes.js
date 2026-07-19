const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getMatches, createMatch, updateMatch, deleteMatch } = require('../controllers/matchController');

router.get('/', getMatches);
router.post('/', auth, createMatch);
router.put('/:id', auth, updateMatch);
router.delete('/:id', auth, deleteMatch);

module.exports = router;