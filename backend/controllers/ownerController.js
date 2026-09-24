const Owner = require('../models/Owner');
const { isMongoConnected, getOwners: getStoreOwners, createOwner: createStoreOwner, updateOwner: updateStoreOwner, deleteOwner: deleteStoreOwner } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

const trimField = (value) => (typeof value === 'string' ? value.trim() : '');

const validateLeadership = (captain, viceCaptain) => {
  if (captain && viceCaptain && captain.toLowerCase() === viceCaptain.toLowerCase()) {
    return 'Captain and Vice Captain must be different';
  }
  return null;
};

exports.getOwners = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json(getStoreOwners());
    }
    const owners = await Owner.find().sort({ createdAt: -1 });
    res.json(owners);
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
      captain: trimField(req.body.captain),
      viceCaptain: trimField(req.body.viceCaptain),
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
      captain: trimField(req.body.captain),
      viceCaptain: trimField(req.body.viceCaptain)
    };

    const leadershipError = validateLeadership(updateData.captain, updateData.viceCaptain);
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
