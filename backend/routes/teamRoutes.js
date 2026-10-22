const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const {
  getTeams,
  getTeam,
  getTeamImage,
  createTeam,
  updateTeamPlayers,
  updateTeam,
  deleteTeam,
  getTeamsByOwner
} = require('../controllers/teamController');

router.get('/', getTeams);
router.get('/owner/:ownerId', getTeamsByOwner);
router.get('/:id/image', getTeamImage);
router.get('/:id', getTeam);
router.post('/', auth, upload.single('logo'), createTeam);
router.put('/:id/players', auth, updateTeamPlayers);
router.put('/:id', auth, upload.single('logo'), updateTeam);
router.delete('/:id', auth, deleteTeam);

module.exports = router;