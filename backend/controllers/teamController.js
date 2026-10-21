const Team = require('../models/Team');
const Player = require('../models/Player');
const { isMongoConnected, getState } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

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

// PUBLIC: team logo served on demand
exports.getTeamImage = async (req, res) => {
  try {
    let logo = '';
    if (!isMongoConnected()) {
      const team = getTeams().find((t) => String(t._id) === String(req.params.id));
      if (!team) return res.status(404).json({ message: 'Team not found' });
      logo = team.logo || '';
    } else {
      const team = await Team.findById(req.params.id).select('logo').lean();
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
    if (!owner || !name) {
      return res.status(400).json({ message: 'Owner and team name are required' });
    }

    const payload = {
      owner: String(owner).trim(),
      name: String(name).trim(),
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
    if (!isMongoConnected()) {
      const team = updateTeamStore(req.params.id, { players: (getTeams().find(t => String(t._id) === String(req.params.id)) || {}).players || [] });
      if (!team) return res.status(404).json({ message: 'Team not found' });
      return res.json(team);
    }

    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const existingPlayerIds = new Set(team.players.map((p) => String(p.player)));

    if (Array.isArray(add)) {
      for (const pid of add) {
        if (!existingPlayerIds.has(String(pid))) {
          team.players.push({ player: pid, joinedAt: new Date() });
          existingPlayerIds.add(String(pid));
        }
        await Player.findByIdAndUpdate(pid, { teamId: team._id, team: team.name }, { new: true });
      }
    }

    if (Array.isArray(remove)) {
      team.players = team.players.filter((p) => !remove.includes(String(p.player)));
      for (const pid of remove) {
        await Player.findByIdAndUpdate(pid, { $unset: { teamId: 1, team: 1 } }, { new: true });
      }
    }

    await team.save();
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
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    res.json({ message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete team', error: error.message });
  }
};