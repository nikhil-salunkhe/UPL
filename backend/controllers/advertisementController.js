const Advertisement = require('../models/Advertisement');
const { isMongoConnected, getState, createSampleId } = require('../config/fallbackStore');
const { fileToDataUrl, resolveImageInput } = require('../utils/imageHelper');

// ---- fallback store helpers ( Advertisement list lives in-memory when Mongo is down ) ----
const getAds = () => {
  const state = getState();
  if (!state.advertisements) state.advertisements = [];
  return state.advertisements;
};

const createAdStore = (payload) => {
  const ad = { _id: createSampleId('ad'), ...payload };
  getAds().unshift(ad);
  return ad;
};

const updateAdStore = (id, payload) => {
  const ads = getAds();
  const index = ads.findIndex((ad) => String(ad._id) === String(id));
  if (index === -1) return null;
  ads[index] = { ...ads[index], ...payload };
  return ads[index];
};

const deleteAdStore = (id) => {
  const ads = getAds();
  const index = ads.findIndex((ad) => String(ad._id) === String(id));
  if (index === -1) return false;
  ads.splice(index, 1);
  return true;
};

// PUBLIC: only active ads, ordered
exports.getAdvertisements = async (req, res) => {
  try {
    // Banner is a base64 data URL stored inline; project it out so this public
    // list stays small (same fix as /owners and /sponsors). The Home slider
    // loads each banner on demand from GET /advertisements/:id/image.
    if (!isMongoConnected()) {
      const ads = getAds()
        .filter((ad) => ad.isActive !== false)
        .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
      return res.json(ads.map(({ banner, ...rest }) => rest));
    }
    const start = process.hrtime.bigint();
    const ads = await Advertisement.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 }).select('-banner').lean();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /advertisements: ${durationMs.toFixed(0)}ms`);
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch advertisements', error: error.message });
  }
};

// ADMIN: all ads including inactive
exports.getAllAdvertisements = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const ads = [...getAds()].sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
      return res.json(ads.map(({ banner, ...rest }) => rest));
    }
    const start = process.hrtime.bigint();
    // Banner is a base64 data URL stored inline; projecting it out keeps this
    // admin list small (same fix as /owners and /sponsors). The dashboard loads
    // each banner on demand from GET /advertisements/:id/image.
    const ads = await Advertisement.find().sort({ displayOrder: 1, createdAt: -1 }).select('-banner').lean();
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[api-timing] GET /advertisements/all: ${durationMs.toFixed(0)}ms`);
    res.json(ads);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch advertisements', error: error.message });
  }
};

// Serve a single advertisement banner on demand (mirrors /owners/:id/image).
exports.getAdvertisementImage = async (req, res) => {
  try {
    let banner = '';
    if (!isMongoConnected()) {
      const ad = getAds().find((a) => String(a._id) === String(req.params.id));
      if (!ad) {
        return res.status(404).json({ message: 'Advertisement not found' });
      }
      banner = ad.banner || '';
    } else {
      const ad = await Advertisement.findById(req.params.id).select('banner').lean();
      if (!ad) {
        return res.status(404).json({ message: 'Advertisement not found' });
      }
      banner = ad.banner || '';
    }

    if (!banner) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.status(404).json({ message: 'No banner for this advertisement' });
    }

    const dataUrlMatch = /^data:([^;,]+);base64,(.*)$/s.exec(banner);
    if (dataUrlMatch) {
      res.set('Cache-Control', 'public, max-age=604800');
      res.set('Content-Type', dataUrlMatch[1]);
      return res.send(Buffer.from(dataUrlMatch[2], 'base64'));
    }

    if (/^https?:\/\//.test(banner) || banner.startsWith('/')) {
      return res.redirect(banner);
    }

    res.set('Cache-Control', 'public, max-age=60');
    return res.status(404).json({ message: 'Unsupported image format' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to load advertisement banner', error: error.message });
  }
};

exports.createAdvertisement = async (req, res) => {
  try {
    const { team, title, description, link, isActive, displayOrder } = req.body;
    if (!team || !title) {
      return res.status(400).json({ message: 'Team and title are required' });
    }
    const payload = {
      team: String(team).trim(),
      title: String(title).trim(),
      description: (description || '').trim(),
      link: (link || '').trim(),
      // Accept either an uploaded file (multer) or a base64 data-URL body
      // field — the dashboard's FileReader flow sends the latter. This used to
      // read only req.file, so banner was silently stored as '' and
      // GET /advertisements/:id/image answered 404 (broken image on Home).
      banner: resolveImageInput(req.body.banner, req.file) || '',
      isActive: isActive === undefined ? true : isActive === true || isActive === 'true',
      displayOrder: Number(displayOrder) || 0
    };
    if (!isMongoConnected()) {
      return res.status(201).json(createAdStore(payload));
    }
    const ad = await Advertisement.create(payload);
    res.status(201).json(ad);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create advertisement', error: error.message });
  }
};

exports.updateAdvertisement = async (req, res) => {
  try {
    const updateData = {};
    if (req.body.team !== undefined) updateData.team = String(req.body.team).trim();
    if (req.body.title !== undefined) updateData.title = String(req.body.title).trim();
    if (req.body.description !== undefined) updateData.description = String(req.body.description).trim();
    if (req.body.link !== undefined) updateData.link = String(req.body.link).trim();
    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive === true || req.body.isActive === 'true';
    }
    if (req.body.displayOrder !== undefined) updateData.displayOrder = Number(req.body.displayOrder) || 0;

    if (req.file && req.file.buffer) {
      updateData.banner = fileToDataUrl(req.file);
    } else {
      const bodyBanner = resolveImageInput(req.body.banner, null);
      if (bodyBanner) updateData.banner = bodyBanner;
    }

    if (!isMongoConnected()) {
      const ad = updateAdStore(req.params.id, updateData);
      if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
      return res.json(ad);
    }
    const ad = await Advertisement.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    res.json(ad);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update advertisement', error: error.message });
  }
};

exports.deleteAdvertisement = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      if (!deleteAdStore(req.params.id)) return res.status(404).json({ message: 'Advertisement not found' });
      return res.json({ message: 'Advertisement deleted' });
    }
    const ad = await Advertisement.findByIdAndDelete(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Advertisement not found' });
    res.json({ message: 'Advertisement deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete advertisement', error: error.message });
  }
};
