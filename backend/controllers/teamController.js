const mongoose = require('mongoose');
const Team = require('../models/Team');
const AuctionResult = require('../models/AuctionResult');
const Player = require('../models/Player');
const { isMongoConnected, getState } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');
const { syncAuctionFromRoster } = require('../utils/auctionService');

const getTeams = () => {
  const state = getState();
  if (!state.teams) state.teams = [];
  return state.teams;
};

const createTeamStore = (payload) => {
  const team = { _id: `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...payload, players: payload.players || [] };
  getTeams().unshift(team);
  return team;
};

const updateTeamStore = (id, payload) => {
  const teams = getTeams();
  const index = teams.findIndex((t) => String(t._id) === String(id));
  if (index === -1) return null;
  teams[index] = { ...teams[index], ...payload };
  return teams[index];
};

const deleteTeamStore = (id) => {
  const teams = getTeams();
  const index = teams.findIndex((t) => String(t._id) === String(id));
  if (index === -1) return false;
  teams.splice(index, 1);
  // The team's auction result has no meaning without the team.
  const auctions = getState().auctions;
  const auctionIndex = auctions.findIndex((a) => String(a.team) === String(id));
  if (auctionIndex !== -1) auctions.splice(auctionIndex, 1);
  return true;
};

// PUBLIC: paginated list of teams (logo projected out — loaded on demand)
exports.getTeams = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const skip = (page - 1) * limit;

    if (!isMongoConnected()) {
      const all = getTeams().map(({ logo, ...rest }) => rest);
      const total = all.length;
      const data = all.slice(skip, skip + limit);
      return res.json({
        success: true,
        data,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
      });
    }

    const [teams, total] = await Promise.all([
      Team.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-logo').lean(),
      Team.countDocuments()
    ]);
    res.json({
      success: true,
      data: teams,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch teams', error: error.message });
  }
};

// PUBLIC: teams owned by a specific owner
exports.getTeamsByOwner = async (req, res) => {
  try {
    const ownerId = req.params.ownerId;

    if (!isMongoConnected()) {
      const all = getTeams();
      const ownerTeams = all.filter((t) => String(t.owner) === String(ownerId));
      const total = ownerTeams.length;
      return res.json({
        success: true,
        data: ownerTeams.map(({ logo, ...rest }) => rest),
        pagination: { page: 1, limit: total, total, totalPages: 1 }
      });
    }

    // An invalid ObjectId would make Mongoose throw a CastError (500).
    if (!mongoose.isValidObjectId(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner id' });
    }

    const [teams, total] = await Promise.all([
      Team.find({ owner: ownerId }).sort({ createdAt: -1 }).select('-logo').lean(),
      Team.countDocuments({ owner: ownerId })
    ]);
    res.json({
      success: true,
      data: teams,
      pagination: { page: 1, limit: total, total, totalPages: 1 }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch teams by owner', error: error.message });
  }
};

// In the Mongo path every lookup goes through ObjectId. An invalid id would
// otherwise surface as a CastError and a misleading 500, so it is rejected
// with a 400 up front. The fallback store uses its own string ids and is
// therefore checked separately (see below).
const isInvalidMongoId = (id) => !mongoose.isValidObjectId(id);

// PUBLIC: single team with its players (players' photos loaded on demand)
exports.getTeam = async (req, res) => {
  try {
    let team;
    if (!isMongoConnected()) {
      team = getTeams().find((t) => String(t._id) === String(req.params.id));
      if (!team) return res.status(404).json({ message: 'Team not found' });
    } else {
      if (isInvalidMongoId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid team id' });
      }
      team = await Team.findById(req.params.id).lean();
      if (!team) return res.status(404).json({ message: 'Team not found' });
    }

    const playerIds = (team.players || []).map((p) => p.player).filter(Boolean);
    let players = [];
    if (playerIds.length > 0) {
      if (!isMongoConnected()) {
        const state = getState();
        players = state.players.filter((p) => playerIds.includes(String(p._id))).map(({ image, ...rest }) => rest);
      } else {
        players = await Player.find({ _id: { $in: playerIds } }).select('-image').lean();
      }
    }

    const playerMap = new Map(players.map((p) => [String(p._id), p]));
    const orderedPlayers = (team.players || [])
      .map((tp) => playerMap.get(String(tp.player)))
      .filter(Boolean);

    res.json({
      ...team,
      players: orderedPlayers,
      logo: team.logo || ''
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch team', error: error.message });
  }
};

// PUBLIC: team logo served on demand
exports.getTeamImage = async (req, res) => {
  try {
    let logo = '';
    const teamId = req.params.id;

    if (!isMongoConnected()) {
      const team = getTeams().find((t) => String(t._id) === String(teamId));
      if (!team) return res.status(404).json({ message: 'Team not found' });
      logo = team.logo || '';
    } else {
      if (isInvalidMongoId(teamId)) {
        return res.status(400).json({ message: 'Invalid team id' });
      }
      const team = await Team.findById(teamId).select('logo').lean();
      if (!team) return res.status(404).json({ message: 'Team not found' });
      logo = team.logo || '';
    }

    if (!logo) return res.status(404).json({ message: 'Team logo not found' });

    const match = logo.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return res.status(404).json({ message: 'Unsupported image format' });

    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(Buffer.from(match[2], 'base64'));
  } catch (error) {
    res.status(500).json({ message: 'Failed to load team logo', error: error.message });
  }
};

// ADMIN/OWNER: create a team
exports.createTeam = async (req, res) => {
  try {
    const { owner, name, logo } = req.body;

    const ownerId = owner === undefined || owner === null ? '' : String(owner).trim();
    const teamName = name === undefined || name === null ? '' : String(name).trim();

    if (!ownerId || !teamName) {
      return res.status(400).json({ message: 'Owner and team name are required' });
    }

    // The owner is stored as an ObjectId ref, so a malformed value would make
    // Team.create() throw a CastError and answer with a misleading 500.
    if (isMongoConnected() && isInvalidMongoId(ownerId)) {
      return res.status(400).json({ message: 'Invalid owner id' });
    }

    const payload = {
      owner: ownerId,
      name: teamName,
      logo: resolveImageInput(logo, req.file) || '',
      players: []
    };

    if (!isMongoConnected()) {
      return res.status(201).json(createTeamStore(payload));
    }

    const team = await Team.create(payload);
    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create team', error: error.message });
  }
};

// ADMIN/OWNER: add/remove players from a team
exports.updateTeamPlayers = async (req, res) => {
  try {
    const { add, remove } = req.body;
    const addIds = (Array.isArray(add) ? add : []).map((id) => String(id));
    const removeIds = new Set((Array.isArray(remove) ? remove : []).map((id) => String(id)));

    if (!isMongoConnected()) {
      const teams = getTeams();
      const index = teams.findIndex((t) => String(t._id) === String(req.params.id));
      if (index === -1) return res.status(404).json({ message: 'Team not found' });

      const team = teams[index];
      const current = Array.isArray(team.players) ? team.players : [];
      const kept = current.filter((entry) => !removeIds.has(String(entry.player)));
      const existing = new Set(kept.map((entry) => String(entry.player)));
      const added = addIds
        .filter((pid) => !existing.has(pid))
        .map((pid) => ({ player: pid, joinedAt: new Date() }));

      team.players = [...kept, ...added];
      teams[index] = team;
      // The auction result is the single source of truth - keep it in step.
      await syncAuctionFromRoster(team);
      return res.json(team);
    }

    if (isInvalidMongoId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid team id' });
    }

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const existingPlayerIds = new Set(team.players.map((p) => String(p.player)));

    if (addIds.length) {
      for (const pid of addIds) {
        if (!mongoose.isValidObjectId(pid)) {
          return res.status(400).json({ message: `Invalid player id: ${pid}` });
        }
        if (!existingPlayerIds.has(pid)) {
          team.players.push({ player: pid, joinedAt: new Date() });
          existingPlayerIds.add(pid);
        }
        await Player.findByIdAndUpdate(pid, { teamId: team._id, team: team.name }, { new: true });
      }
    }

    if (removeIds.size) {
      team.players = team.players.filter((p) => !removeIds.has(String(p.player)));
      for (const pid of removeIds) {
        if (!mongoose.isValidObjectId(pid)) continue;
        await Player.findByIdAndUpdate(pid, { $unset: { teamId: 1, team: 1 } }, { new: true });
      }
    }

    await team.save();
    // The auction result is the single source of truth - keep it in step.
    await syncAuctionFromRoster(team);
    res.json(team);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update team players', error: error.message });
  }
};

// ADMIN/OWNER: update team details (name, logo)
exports.updateTeam = async (req, res) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
    if (req.body.logo !== undefined) {
      const bodyLogo = resolveImageInput(req.body.logo, null);
      if (bodyLogo) updateData.logo = bodyLogo;
    }
    if (req.file && req.file.buffer) updateData.logo = fileToDataUrl(req.file);

    if (!isMongoConnected()) {
      const team = updateTeamStore(req.params.id, updateData);
      if (!team) return res.status(404).json({ message: 'Team not found' });
      return res.json(team);
    }

    if (isInvalidMongoId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid team id' });
    }

    const team = await Team.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json(team);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update team', error: error.message });
  }
};

// ADMIN/OWNER: delete a team
exports.deleteTeam = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      if (!deleteTeamStore(req.params.id)) return res.status(404).json({ message: 'Team not found' });
      return res.json({ message: 'Team deleted' });
    }

    if (isInvalidMongoId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid team id' });
    }

    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    // The team's auction result has no meaning without the team.
    await AuctionResult.deleteMany({ team: team._id });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete team', error: error.message });
  }
};