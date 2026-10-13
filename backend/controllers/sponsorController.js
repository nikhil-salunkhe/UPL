const Sponsor = require('../models/Sponsor');
const { isMongoConnected, getSponsors: getStoreSponsors, createSponsor: createStoreSponsor, updateSponsor: updateStoreSponsor, deleteSponsor: deleteStoreSponsor } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

exports.getSponsors = async (req, res) => {
  try {
    // Sponsor logos are base64 data URLs stored inline; embedding them made this
    // list multi-MB and slow (same issue as /owners). Project the logo out — the
    // UI loads each logo on demand from GET /sponsors/:id/image.
    if (!isMongoConnected()) {
      return res.json(getStoreSponsors().map(({ logo, ...rest }) => rest));
    }
    const start = process.hrtime.bigint();
    const sponsors = await Sponsor.find().sort({ createdAt: -1 }).select('-logo').lean();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /sponsors: ${durationMs.toFixed(0)}ms`);
    res.json(sponsors);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sponsors', error: error.message });
  }
};

// Serve a single sponsor logo on demand (mirrors GET /owners/:id/image).
exports.getSponsorImage = async (req, res) => {
  try {
    let logo = '';
    if (!isMongoConnected()) {
      const sponsor = getStoreSponsors().find((s) => String(s._id) === String(req.params.id));
      if (!sponsor) {
        return res.status(404).json({ message: 'Sponsor not found' });
      }
      logo = sponsor.logo || '';
    } else {
      const sponsor = await Sponsor.findById(req.params.id).select('logo').lean();
      if (!sponsor) {
        return res.status(404).json({ message: 'Sponsor not found' });
      }
      logo = sponsor.logo || '';
    }

    if (!logo) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.status(404).json({ message: 'No logo for this sponsor' });
    }

    // Data URL stored by imageHelper.fileToDataUrl → decode back to bytes.
    const dataUrlMatch = /^data:([^;,]+);base64,(.*)$/s.exec(logo);
    if (dataUrlMatch) {
      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Content-Type', dataUrlMatch[1]);
      return res.send(Buffer.from(dataUrlMatch[2], 'base64'));
    }

    if (/^https?:\/\//.test(logo) || logo.startsWith('/')) {
      return res.redirect(logo);
    }

    res.set('Cache-Control', 'public, max-age=60');
    return res.status(404).json({ message: 'Unsupported image format' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load sponsor logo', error: error.message });
  }
};

exports.createSponsor = async (req, res) => {
  try {
    const payload = {
      companyName: req.body.companyName,
      sponsoredPrice: req.body.sponsoredPrice || '',
      phone: req.body.phone,
      logo: fileToDataUrl(req.file)
    };

    if (!isMongoConnected()) {
      const sponsor = createStoreSponsor(payload);
      return res.status(201).json(sponsor);
    }

    const sponsor = await Sponsor.create(payload);
    res.status(201).json(sponsor);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create sponsor', error: error.message });
  }
};

exports.updateSponsor = async (req, res) => {
  try {
    const updateData = {
      companyName: req.body.companyName,
      sponsoredPrice: req.body.sponsoredPrice || '',
      phone: req.body.phone
    };

    if (req.file && req.file.buffer) {
      updateData.logo = fileToDataUrl(req.file);
    } else {
      const bodyLogo = resolveImageInput(req.body.logo, null);
      if (bodyLogo) updateData.logo = bodyLogo;
    }

    if (!isMongoConnected()) {
      const sponsor = updateStoreSponsor(req.params.id, updateData);
      if (!sponsor) {
        return res.status(404).json({ message: 'Sponsor not found' });
      }
      return res.json(sponsor);
    }

    const sponsor = await Sponsor.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!sponsor) {
      return res.status(404).json({ message: 'Sponsor not found' });
    }

    res.json(sponsor);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update sponsor', error: error.message });
  }
};

exports.deleteSponsor = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const deleted = deleteStoreSponsor(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Sponsor not found' });
      }
      return res.json({ message: 'Sponsor deleted' });
    }

    const sponsor = await Sponsor.findByIdAndDelete(req.params.id);
    if (!sponsor) {
      return res.status(404).json({ message: 'Sponsor not found' });
    }

    res.json({ message: 'Sponsor deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete sponsor', error: error.message });
  }
};
