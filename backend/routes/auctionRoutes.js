const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const {
  getTeamAuctionResult,
  getAuctionResults,
  saveTeamAuctionResult
} = require('../controllers/auctionController');

// The auction result decides the roster and the leadership of a team, so
// every endpoint here is restricted to administrators of the panel.
router.get('/', auth, adminOnly, getAuctionResults);
router.get('/team/:teamId', auth, adminOnly, getTeamAuctionResult);
router.put('/team/:teamId', auth, adminOnly, saveTeamAuctionResult);

module.exports = router;
