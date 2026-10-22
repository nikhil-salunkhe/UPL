const Owner = require('../models/Owner');
const Team = require('../models/Team');
const Player = require('../models/Player');
const { isMongoConnected, getOwners: getStoreOwners, createOwner: createStoreOwner, updateOwner: updateStoreOwner, deleteOwner: deleteStoreOwner, getPlayers: getStorePlayers, getTeams: getStoreTeams } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

const trimField = (value) => (typeof value === 'string' ? value.trim() : '');

const parseDisplayOrder = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

// Captain / vice-captain are player NAMES — never allow an image data URL or
// other junk to be stored there (this caused "data:image/..." text on Home).
const sanitizeLeaderName = (value) => {
  const name = trimField(value);
  if (!name) return '';
  if (/^data:/i.test(name) || /^blob:/i.test(name) || /^https?:\/\//i.test(name)) return '';
  if (name.length > 80) return '';
  return name;
};

// The squad is a list of player NAMES. It is sanitized exactly like the
// captain / vice-captain name fields, and duplicates are dropped.
const sanitizeSquad = (value) => {
  if (!Array.isArray(value)) return [];
  const names = value
    .map((name) => sanitizeLeaderName(name))
    .filter(Boolean);
  return [...new Set(names)];
};

// The squad is submitted as a JSON string (the form is a FormData upload),
// but a plain array is accepted too.
const parseSquad = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return sanitizeSquad(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return sanitizeSquad(parsed);
    } catch (e) {
      // Not JSON - treat it as a single name.
      return sanitizeSquad([trimmed]);
    }
  }
  return [];
};

// A squad is capped at 15 players (a full football squad). Duplicates were already
// removed by sanitizeSquad above, so a size breach is a hard reject.
const MAX_SQUAD_PLAYERS = 15;

// Captain / vice-captain are player NAMES — guard against corrupted records
// where an image data URL ended up in these fields (renders as base64 text).

const validateLeadership = (captain, viceCaptain) => {
  if (captain && viceCaptain && captain.toLowerCase() === viceCaptain.toLowerCase()) {
    return 'Captain and Vice Captain must be different';
  }
  return null;
};

exports.getOwners = async (req, res) => {
  try {
    // Read-time guard: older records may have an image data URL saved in
    // captain/viceCaptain — never send that to the client as a "name".
    // Owner photos (`image`) are base64 data URLs stored inline; embedding them
    // made this list ~4 MB / ~50s and blew the client timeout. Project the
    // photo out — the UI loads each logo on demand from GET /owners/:id/image.
    const clean = (list) => list.map((o) => {
      const obj = o && typeof o.toObject === 'function' ? o.toObject() : { ...o };
      obj.captain = sanitizeLeaderName(obj.captain);
      obj.viceCaptain = sanitizeLeaderName(obj.viceCaptain);
      obj.players = sanitizeSquad(obj.players);
      if (obj.displayOrder === undefined || obj.displayOrder === null) obj.displayOrder = 0;
      delete obj.image;
      return obj;
    });
    const sortByOrder = (list) => [...list].sort(
      (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
    );
    if (!isMongoConnected()) {
      return res.json(sortByOrder(clean(getStoreOwners())));
    }
    const start = process.hrtime.bigint();
    const owners = await Owner.find().sort({ displayOrder: 1, createdAt: 1 }).select('-image').lean();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /owners: ${durationMs.toFixed(0)}ms`);
    res.json(clean(owners));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch owners', error: error.message });
  }
};

// Serve a single owner photo on demand (mirrors GET /players/:id/image).
// List responses exclude the photo to keep the payload small; the Home page
// requests each team logo individually and caches it in the browser.
exports.getOwnerImage = async (req, res) => {
  try {
    let image = '';
    if (!isMongoConnected()) {
      const owner = getStoreOwners().find((o) => String(o._id) === String(req.params.id));
      if (!owner) {
        return res.status(404).json({ message: 'Owner not found' });
      }
      image = owner.image || '';
    } else {
      const owner = await Owner.findById(req.params.id).select('image').lean();
      if (!owner) {
        return res.status(404).json({ message: 'Owner not found' });
      }
      image = owner.image || '';
    }

    if (!image) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.status(404).json({ message: 'No image for this owner' });
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
    res.status(500).json({ message: 'Failed to load owner image', error: error.message });
  }
};

// Keep the owner's Team document in sync with their squad/captain/vice-captain so
// the public Teams page renders it with the owner's logo, team name and leaders.
async function syncOwnerTeam(owner) {
  if (!owner || !owner._id) return;
  // Owner now stores player IDs (not names), so resolve directly. Legacy
  // name-based values are still tolerated by looking them up by name.
  const squadIds = sanitizeSquad(owner.players || []);
  const captainRaw = sanitizeLeaderName(owner.captain);
  const viceCaptainRaw = sanitizeLeaderName(owner.viceCaptain);

  if (!isMongoConnected()) {
    const players = getStorePlayers();
    const byId = new Map(players.map((p) => [String(p._id), p]));
    const byName = new Map(players.map((p) => [String(p.name || '').trim().toLowerCase(), p]));
    const resolveId = (value) => {
      if (!value) return null;
      if (byId.has(String(value))) return value;
      return byName.get(String(value).trim().toLowerCase())?._id || null;
    };
    const playerIds = [...new Set(squadIds.map((v) => resolveId(v)).filter(Boolean))];
    const captainId = resolveId(captainRaw);
    const viceCaptainId = resolveId(viceCaptainRaw);
    const teams = getStoreTeams();
    const payload = {
      _id: teams.find((t) => String(t.owner) === String(owner._id))?._id || `team-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      owner: owner._id,
      name: trimField(owner.team) || trimField(owner.name),
      logo: owner.image || '',
      captain: captainId,
      viceCaptain: viceCaptainId,
      players: playerIds.map((id) => ({ player: id, joinedAt: new Date() }))
    };
    const idx = teams.findIndex((t) => String(t.owner) === String(owner._id));
    if (idx === -1) teams.unshift(payload);
    else teams[idx] = { ...teams[idx], ...payload };
    return;
  }

  const allPlayers = await Player.find().select('_id name').lean();
  const byId = new Map(allPlayers.map((p) => [String(p._id), p._id]));
  const byName = new Map(allPlayers.map((p) => [String(p.name || '').trim().toLowerCase(), p._id]));
  const resolveId = (value) => {
    if (!value) return null;
    if (byId.has(String(value))) return value;
    return byName.get(String(value).trim().toLowerCase()) || null;
  };
  const playerIds = [...new Set(squadIds.map((v) => resolveId(v)).filter(Boolean))];
  const captainId = resolveId(captainRaw);
  const viceCaptainId = resolveId(viceCaptainRaw);

  await Team.findOneAndUpdate(
    { owner: owner._id },
    {
      owner: owner._id,
      name: trimField(owner.team) || trimField(owner.name),
      logo: owner.image || '',
      captain: captainId,
      viceCaptain: viceCaptainId,
      players: playerIds.map((id) => ({ player: id, joinedAt: new Date() }))
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
exports.createOwner = async (req, res) => {
  try {
    const captain = sanitizeLeaderName(req.body.captain);
    const viceCaptain = sanitizeLeaderName(req.body.viceCaptain);
    const players = parseSquad(req.body.players) || [];
    // The captain and the vice captain are always part of the squad: when a
    // squad is provided without them they are added automatically instead of
    // rejecting the save, so a leader can never end up outside their own team.
    const squad = [...new Set([...players, ...(captain ? [captain] : []), ...(viceCaptain ? [viceCaptain] : [])])];

    const payload = {
      name: req.body.name,
      phone: req.body.phone,
      team: trimField(req.body.team),
      captain,
      viceCaptain,
      players: squad,
      image: fileToDataUrl(req.file)
    };

    const leadershipError = validateLeadership(payload.captain, payload.viceCaptain);
    if (leadershipError) {
      return res.status(400).json({ message: leadershipError });
    }

    if (squad.length > MAX_SQUAD_PLAYERS) {
      return res.status(400).json({ message: `Squad cannot exceed ${MAX_SQUAD_PLAYERS} players` });
    }

    if (!isMongoConnected()) {
      const owner = createStoreOwner(payload);
      await syncOwnerTeam(owner);
      return res.status(201).json(owner);
    }

    const owner = await Owner.create(payload);
    await syncOwnerTeam(owner);
    res.status(201).json(owner);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create owner', error: error.message });
  }
};

exports.updateOwner = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      team: trimField(req.body.team),
      captain: req.body.captain !== undefined ? sanitizeLeaderName(req.body.captain) : undefined,
      viceCaptain: req.body.viceCaptain !== undefined ? sanitizeLeaderName(req.body.viceCaptain) : undefined
    };

    // A squad update replaces the whole squad (empty array = clear it).
    const squad = parseSquad(req.body.players);
    if (squad !== undefined) updateData.players = squad;

    const order = parseDisplayOrder(req.body.displayOrder);
    if (order !== undefined) updateData.displayOrder = order;

    // Drop undefined keys so partial updates don't overwrite with undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    // Load the stored owner once so partial updates (e.g. only the squad is
    // changed) can be validated against the captain / vice captain / squad that
    // are already on record.
    let existing = null;
    try {
      if (!isMongoConnected()) {
        existing = getStoreOwners().find((o) => String(o._id) === String(req.params.id)) || null;
      } else {
        existing = await Owner.findById(req.params.id);
      }
    } catch (e) {
      existing = null;
    }

    // Validate against merged values so partial updates (only captain or only
    // viceCaptain) still reject C === VC correctly.
    let mergedCaptain = updateData.captain !== undefined ? updateData.captain : (existing?.captain || '');
    let mergedViceCaptain = updateData.viceCaptain !== undefined ? updateData.viceCaptain : (existing?.viceCaptain || '');
    let mergedSquad = updateData.players !== undefined ? updateData.players : sanitizeSquad(existing?.players || []);

    const leadershipError = validateLeadership(mergedCaptain, mergedViceCaptain);
    if (leadershipError) {
      return res.status(400).json({ message: leadershipError });
    }

    // The captain and the vice captain are always part of the squad. When a
    // squad is provided without them they are added automatically instead of
    // rejecting the save, so a leader can never end up outside their own team.
    if (mergedSquad.length) {
      for (const leader of [mergedCaptain, mergedViceCaptain]) {
        if (leader && !mergedSquad.includes(leader)) mergedSquad.push(leader);
      }
      updateData.players = mergedSquad;
    }

    // The squad is capped at 15 players. The auto-included leaders
    // are counted in the cap, so a squad that grew to 15 can never grow further.
    if (updateData.players && updateData.players.length > MAX_SQUAD_PLAYERS) {
      return res.status(400).json({ message: `Squad cannot exceed ${MAX_SQUAD_PLAYERS} players` });
    }

    if (req.file && req.file.buffer) {
      updateData.image = fileToDataUrl(req.file);
    } else {
      const bodyImage = resolveImageInput(req.body.image, null);
      if (bodyImage) updateData.image = bodyImage;
    }

    if (!isMongoConnected()) {
      const owner = updateStoreOwner(req.params.id, updateData);
      if (!owner) {
        return res.status(404).json({ message: 'Owner not found' });
      }
      await syncOwnerTeam(owner);
      return res.json(owner);
    }

    const owner = await Owner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }
    await syncOwnerTeam(owner);
    res.json(owner);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update owner', error: error.message });
  }
};

exports.deleteOwner = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const deleted = deleteStoreOwner(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Owner not found' });
      }
      const teams = getStoreTeams();
      for (let i = teams.length - 1; i >= 0; i--) {
        if (String(teams[i].owner) === String(req.params.id)) teams.splice(i, 1);
      }
      return res.json({ message: 'Owner deleted' });
    }

    const owner = await Owner.findByIdAndDelete(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }
    await Team.deleteMany({ owner: owner._id });
    res.json({ message: 'Owner deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete owner', error: error.message });
  }
};

// Save full display order in one call: { order: [id1, id2, ...] }
exports.reorderOwners = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ message: 'order must be an array of owner ids' });
    }
    if (!isMongoConnected()) {
      const { reorderOwners: reorderStore } = require('../config/fallbackStore');
      const owners = reorderStore(order);
      return res.json(owners);
    }
    const updates = order.map((id, index) =>
      Owner.findByIdAndUpdate(id, { displayOrder: index + 1 }, { new: true })
    );
    await Promise.all(updates);
    const owners = await Owner.find().sort({ displayOrder: 1, createdAt: 1 });
    res.json(owners);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reorder owners', error: error.message });
  }
};
