const Sponsor = require('../models/Sponsor');
const { isMongoConnected, getSponsors: getStoreSponsors, createSponsor: createStoreSponsor, updateSponsor: updateStoreSponsor, deleteSponsor: deleteStoreSponsor } = require('../config/fallbackStore');

exports.getSponsors = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json(getStoreSponsors());
    }
    const sponsors = await Sponsor.find().sort({ createdAt: -1 });
    res.json(sponsors);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sponsors', error: error.message });
  }
};

exports.createSponsor = async (req, res) => {
  try {
    const payload = {
      companyName: req.body.companyName,
      sponsoredPrice: req.body.sponsoredPrice || '',
      phone: req.body.phone,
      logo: req.file ? `/uploads/${req.file.filename}` : ''
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

    if (req.file) {
      updateData.logo = `/uploads/${req.file.filename}`;
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
