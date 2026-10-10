const mongoose = require('mongoose');
const Player = require('../models/Player');
const { isMongoConnected, getPlayers: getStorePlayers, createPlayer: createStorePlayer, updatePlayer: updateStorePlayer, deletePlayer: deleteStorePlayer } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');
const { parsePagination, statusFilter, matchesStatus, countByStatus } = require('../utils/queryHelper');

const parseAge = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isApproved = (player) => !player.status || player.status === 'approved';

exports.getPlayers = async (req, res) => {
  try {
    // Photos (`image`) are excluded from list responses: base64 data URLs made
    // this payload ~20 MB / >10s and broke client timeouts. The UI loads each
    // photo on demand from GET /players/:id/image instead.
    if (!isMongoConnected()) {
      // Public list: only approved players
      return res.json(getStorePlayers().filter(isApproved).map(({ image, ...rest }) => rest));
    }
    const players = await Player.find({ status: { $in: ['approved', null] } }).sort({ createdAt: -1 }).select('-image').lean();
    // Backfill: legacy docs without status still show up
    const legacy = await Player.find({ status: { $exists: false } }).sort({ createdAt: -1 }).select('-image').lean();
    const merged = [...players, ...legacy.filter((p) => !players.some((q) => q._id.equals(p._id)))];
    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
};

// Admin-only list.
// - With ?page / ?limit / ?status → paginated envelope:
//     { success, data, pagination: { page, limit, total, totalPages }, counts }
// - Without query params → bare array (legacy shape so clients deployed before
//   this change keep working during a rolling deploy).
// Either way `image` is projected out — embedded photos made this response
// 23.5 MB / 15.4s in production and the 10s client timeout always fired.
exports.getAllPlayers = async (req, res) => {
  try {
    const usePagination = ['page', 'limit', 'status'].some((key) => key in req.query);

    if (!isMongoConnected()) {
      const all = getStorePlayers().map(({ image, ...rest }) => rest);
      if (!usePagination) {
        return res.json(all);
      }
      const parsed = parsePagination(req.query);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      const filtered = all.filter((player) => matchesStatus(player, parsed.status));
      const counts = countByStatus(getStorePlayers());
      return res.json({
        success: true,
        data: filtered.slice(parsed.skip, parsed.skip + parsed.limit),
        pagination: {
          page: parsed.page,
          limit: parsed.limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / parsed.limit))
        },
        counts
      });
    }

    if (!usePagination) {
      const players = await Player.find().sort({ createdAt: -1 }).select('-image').lean();
      return res.json(players);
    }

    const parsed = parsePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const filter = statusFilter(parsed.status);
    const [players, total, allCount, pendingCount] = await Promise.all([
      Player.find(filter).sort({ createdAt: -1 }).skip(parsed.skip).limit(parsed.limit).select('-image').lean(),
      Player.countDocuments(filter),
      Player.countDocuments({}),
      Player.countDocuments({ status: 'pending' })
    ]);

    res.json({
      success: true,
      data: players,
      pagination: {
        page: parsed.page,
        limit: parsed.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / parsed.limit))
      },
      counts: { all: allCount, pending: pendingCount, approved: allCount - pendingCount }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
};

// PUBLIC: serve a single player photo on demand. List endpoints exclude the
// base64 `image` field, so the UI points <img src> here — only photos that are
// actually visible get downloaded, and each response is one small document.
exports.getPlayerImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid player id' });
    }

    let image = '';
    if (!isMongoConnected()) {
      const player = getStorePlayers().find((p) => String(p._id) === id);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      image = player.image || '';
    } else {
      const player = await Player.findById(id).select('image').lean();
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }
      image = player.image || '';
    }

    if (!image) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.status(404).json({ message: 'No image for this player' });
    }

    // Data URL stored by imageHelper.fileToDataUrl → decode back to bytes.
    const dataUrlMatch = /^data:([^;,]+);base64,(.*)$/s.exec(image);
    if (dataUrlMatch) {
      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Content-Type', dataUrlMatch[1]);
      return res.send(Buffer.from(dataUrlMatch[2], 'base64'));
    }

    // Legacy records: absolute http(s) URL, or a /uploads path served by the
    // static middleware below the API.
    if (/^https?:\/\//.test(image) || image.startsWith('/')) {
      return res.redirect(image);
    }

    res.set('Cache-Control', 'public, max-age=60');
    return res.status(404).json({ message: 'Unsupported image format' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load player image', error: error.message });
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
