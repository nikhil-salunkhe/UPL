const mongoose = require('mongoose');
const Team = require('../models/Team');
const Player = require('../models/Player');
const { isMongoConnected, getState } = require('../config/fallbackStore');
const {
  saveAuction,
  getTeamAuction,
  listAuctions,
  toIdList
} = require('../utils/auctionService');

const isInvalidMongoId = (id) => !mongoose.isValidObjectId(id);

// Loads a team from either backend.
const findTeam = async (teamId) => {
  if (!isMongoConnected()) {
    const team = getState().teams.find((t) => String(t._id) === String(teamId));
    return team ? { team, mongo: false } : { team: null, mongo: false };
  }
  if (isInvalidMongoId(teamId)) return { team: null, mongo: true, invalid: true };
  const team = await Team.findById(teamId).lean();
  return { team, mongo: true };
};

// Loads the players referenced by an auction result, as full objects.
const loadSquadPlayers = async (ids) => {
  if (!ids.length) return [];
  if (!isMongoConnected()) {
    const state = getState();
    return state.players
      .filter((p) => ids.includes(String(p._id)))
      .map(({ image, ...rest }) => rest);
  }
  return Player.find({ _id: { $in: ids } }).select('-image').lean();
};

// ADMIN: the auction result of one team, with its squad resolved to players.
exports.getTeamAuctionResult = async (req, res) => {
  try {
    const { team, invalid } = await findTeam(req.params.teamId);
    if (invalid) return res.status(400).json({ message: 'Invalid team id' });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const auction = await getTeamAuction(team._id);
    if (!auction) {
      return res.json({
        success: true,
        data: null,
        team: { _id: team._id, name: team.name },
        players: [],
        captain: null,
        viceCaptain: null
      });
    }

    const squadIds = toIdList(auction.players);
    const players = await loadSquadPlayers(squadIds);

    res.json({
      success: true,
      data: auction,
      team: { _id: team._id, name: team.name, owner: team.owner },
      players,
      captain: auction.captain || null,
      viceCaptain: auction.viceCaptain || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch auction result', error: error.message });
  }
};

// ADMIN: every auction result.
exports.getAuctionResults = async (req, res) => {
  try {
    const auctions = await listAuctions();
    res.json({ success: true, data: auctions, count: auctions.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch auction results', error: error.message });
  }
};

// ADMIN: save the auction result of a team. The squad, the captain and the
// vice-captain are written together and always stay consistent.
exports.saveTeamAuctionResult = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { players: squadInput, captain, viceCaptain } = req.body || {};

    const { team, invalid } = await findTeam(teamId);
    if (invalid) return res.status(400).json({ message: 'Invalid team id' });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const squad = toIdList(squadInput);
    const cap = captain ? String(captain).trim() : '';
    const vice = viceCaptain ? String(viceCaptain).trim() : '';

    // A captain / vice-captain must be part of the squad.
    if (cap && !squad.includes(cap)) {
      return res.status(400).json({ message: 'Captain must be one of the selected squad players' });
    }
    if (vice && !squad.includes(vice)) {
      return res.status(400).json({ message: 'Vice Captain must be one of the selected squad players' });
    }
    if (cap && vice && cap === vice) {
      return res.status(400).json({ message: 'Captain and Vice Captain must be different' });
    }
    if (!squad.length) {
      return res.status(400).json({ message: 'Select at least one player for the squad' });
    }

    // Every squad member must exist.
    const existingIds = new Set((await loadSquadPlayers(squad)).map((p) => String(p._id)));
    const missing = squad.filter((pid) => !existingIds.has(pid));
    if (missing.length) {
      return res.status(400).json({ message: `Unknown player: ${missing[0]}` });
    }

    const result = await saveAuction({
      teamId: team._id,
      ownerId: team.owner,
      players: squad,
      captain: cap,
      viceCaptain: vice
    });

    if (!result) return res.status(404).json({ message: 'Team not found' });

    const players = await loadSquadPlayers(squad);
    res.json({
      success: true,
      message: 'Auction result saved',
      data: result.auction,
      team: result.team,
      players,
      captain: cap || null,
      viceCaptain: vice || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to save auction result' });
  }
};

module.exports = {
  getTeamAuctionResult: exports.getTeamAuctionResult,
  getAuctionResults: exports.getAuctionResults,
  saveTeamAuctionResult: exports.saveTeamAuctionResult
};
