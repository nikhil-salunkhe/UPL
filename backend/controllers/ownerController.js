const Owner = require('../models/Owner');
const { isMongoConnected, getOwners: getStoreOwners, createOwner: createStoreOwner, updateOwner: updateStoreOwner, deleteOwner: deleteStoreOwner } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

const trimField = (value) => (typeof value === 'string' ? value.trim() : '');

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
    const clean = (list) => list.map((o) => {
      const obj = o && typeof o.toObject === 'function' ? o.toObject() : { ...o };
      obj.captain = sanitizeLeaderName(obj.captain);
      obj.viceCaptain = sanitizeLeaderName(obj.viceCaptain);
      return obj;
    });
    if (!isMongoConnected()) {
      return res.json(clean(getStoreOwners()));
    }
    const owners = await Owner.find().sort({ createdAt: -1 });
    res.json(clean(owners));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch owners', error: error.message });
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
