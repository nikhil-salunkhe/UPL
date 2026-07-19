const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getActiveTournament, createOrUpdateTournament, deleteTournament } = require('../controllers/tournamentController');

router.get('/', getActiveTournament);
router.post('/', auth, createOrUpdateTournament);
router.delete('/', auth, deleteTournament);

module.exports = router;