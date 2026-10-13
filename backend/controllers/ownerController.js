const Owner = require('../models/Owner');
const { isMongoConnected, getOwners: getStoreOwners, createOwner: createStoreOwner, updateOwner: updateStoreOwner, deleteOwner: deleteStoreOwner } = require('../config/fallbackStore');
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

exports.createOwner = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      phone: req.body.phone,
      team: trimField(req.body.team),
      captain: sanitizeLeaderName(req.body.captain),
      viceCaptain: sanitizeLeaderName(req.body.viceCaptain),
      image: fileToDataUrl(req.file)
    };

    const order = parseDisplayOrder(req.body.displayOrder);
    if (order !== undefined) payload.displayOrder = order;

    const leadershipError = validateLeadership(payload.captain, payload.viceCaptain);
    if (leadershipError) {
      return res.status(400).json({ message: leadershipError });
    }

    if (!isMongoConnected()) {
      const owner = createStoreOwner(payload);
      return res.status(201).json(owner);
    }

    const owner = await Owner.create(payload);
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

    const order = parseDisplayOrder(req.body.displayOrder);
    if (order !== undefined) updateData.displayOrder = order;

    // Drop undefined keys so partial updates don't overwrite with undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    // Validate against merged values so partial updates (only captain or only
    // viceCaptain) still reject C === VC correctly.
    let mergedCaptain = updateData.captain;
    let mergedViceCaptain = updateData.viceCaptain;
    if (mergedCaptain === undefined || mergedViceCaptain === undefined) {
      try {
        let existing = null;
        if (!isMongoConnected()) {
          existing = getStoreOwners().find((o) => String(o._id) === String(req.params.id)) || null;
        } else {
          existing = await Owner.findById(req.params.id);
        }
        if (mergedCaptain === undefined) mergedCaptain = existing?.captain || '';
        if (mergedViceCaptain === undefined) mergedViceCaptain = existing?.viceCaptain || '';
      } catch (e) {
        if (mergedCaptain === undefined) mergedCaptain = '';
        if (mergedViceCaptain === undefined) mergedViceCaptain = '';
      }
    }

    const leadershipError = validateLeadership(mergedCaptain, mergedViceCaptain);
    if (leadershipError) {
      return res.status(400).json({ message: leadershipError });
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
      return res.json(owner);
    }

    const owner = await Owner.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }

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
      return res.json({ message: 'Owner deleted' });
    }

    const owner = await Owner.findByIdAndDelete(req.params.id);
    if (!owner) {
      return res.status(404).json({ message: 'Owner not found' });
    }

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
