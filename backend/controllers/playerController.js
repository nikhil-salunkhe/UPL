const Player = require('../models/Player');
const { isMongoConnected, getPlayers: getStorePlayers, createPlayer: createStorePlayer, updatePlayer: updateStorePlayer, deletePlayer: deleteStorePlayer } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

const parseAge = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isApproved = (player) => !player.status || player.status === 'approved';

exports.getPlayers = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      // Public list: only approved players
      return res.json(getStorePlayers().filter(isApproved));
    }
    const players = await Player.find({ status: { $in: ['approved', null] } }).sort({ createdAt: -1 });
    // Backfill: legacy docs without status still show up
    const legacy = await Player.find({ status: { $exists: false } }).sort({ createdAt: -1 });
    const merged = [...players, ...legacy.filter((p) => !players.some((q) => q._id.equals(p._id)))];
    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
};

// Admin-only: see EVERYTHING including pending registrations
exports.getAllPlayers = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json(getStorePlayers());
    }
    const players = await Player.find().sort({ createdAt: -1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
};

exports.createPlayer = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      role: req.body.role,
      team: req.body.team || '',
      phone: (req.body.phone || '').trim(),
      image: fileToDataUrl(req.file),
      status: 'approved'
    };

    const age = parseAge(req.body.age);
    if (age !== null) {
      payload.age = age;
    }

    if (!isMongoConnected()) {
      const player = createStorePlayer(payload);
      return res.status(201).json(player);
    }

    const player = await Player.create(payload);
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create player', error: error.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      role: req.body.role,
      team: req.body.team || '',
      phone: (req.body.phone || '').trim()
    };

    const age = parseAge(req.body.age);
    if (age !== null) {
      updateData.age = age;
    }

    if (req.file && req.file.buffer) {
      updateData.image = fileToDataUrl(req.file);
    } else {
      const bodyImage = resolveImageInput(req.body.image, null);
      if (bodyImage) updateData.image = bodyImage;
    }

    if (!isMongoConnected()) {
      const player = updateStorePlayer(req.params.id, updateData);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      return res.json(player);
    }

    const player = await Player.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update player', error: error.message });
  }
};

exports.deletePlayer = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const deleted = deleteStorePlayer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Player not found' });
      }
      return res.json({ message: 'Player deleted' });
    }

    const player = await Player.findByIdAndDelete(req.params.id);
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json({ message: 'Player deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete player', error: error.message });
  }
};

// PUBLIC: self-registration — no login needed, always saved as pending
// Separate form: only name, role, team, photo (no age / phone required)
exports.registerPlayer = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const role = (req.body.role || '').trim();

    if (!name || !role) {
      return res.status(400).json({ message: 'Player name and role are required' });
    }

    const payload = {
      name,
      role,
      team: (req.body.team || '').trim(),
      image: fileToDataUrl(req.file),
      status: 'pending'
    };

    if (!isMongoConnected()) {
      const player = createStorePlayer(payload);
      return res.status(201).json(player);
    }

    const player = await Player.create(payload);
    res.status(201).json(player);
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// ADMIN: approve a pending registration
exports.approvePlayer = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const player = updateStorePlayer(req.params.id, { status: 'approved' });
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      return res.json(player);
    }

    const player = await Player.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );
    if (!player) {
      return res.status(404).json({ message: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve player', error: error.message });
  }
};
