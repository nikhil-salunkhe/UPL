const Tournament = require('../models/Tournament');
const { isMongoConnected, getTournament, setTournament, deleteTournament: deleteStoreTournament } = require('../config/fallbackStore');

exports.getActiveTournament = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const tournament = getTournament();
      return res.json(tournament);
    }
    const tournament = await Tournament.findOne({ isActive: true }).sort({ createdAt: -1 });
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tournament', error: error.message });
  }
};

exports.deleteTournament = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      deleteStoreTournament();
      return res.json({ message: 'Tournament deleted' });
    }
    await Tournament.updateMany({ isActive: true }, { isActive: false });
    res.json({ message: 'Tournament deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete tournament', error: error.message });
  }
};

exports.createOrUpdateTournament = async (req, res) => {
  try {
    const { auctionDate, matchStartDate, matchEndDate, lotA, lotB, lotADay, lotBDay, venue } = req.body;

    if (!auctionDate) {
      return res.status(400).json({ message: 'Auction date is required' });
    }

    if (!isMongoConnected()) {
      const existing = getTournament();
      const payload = {
        auctionDate: new Date(auctionDate),
        matchStartDate: matchStartDate ? new Date(matchStartDate) : (existing?.matchStartDate || null),
        matchEndDate: matchEndDate ? new Date(matchEndDate) : (existing?.matchEndDate || null),
        lotA: lotA || existing?.lotA || 'Lot A',
        lotB: lotB || existing?.lotB || 'Lot B',
        lotADay: Number(lotADay) || existing?.lotADay || 1,
        lotBDay: Number(lotBDay) || existing?.lotBDay || 2,
        venue: venue || existing?.venue || 'जुगाइदेवी स्टेडियम उरूल'
      };
      const tournament = setTournament(payload);
      return res.json(tournament);
    }

    let tournament;
    const existing = await Tournament.findOne({ isActive: true }).sort({ createdAt: -1 });

    if (existing) {
      // Update existing tournament
      existing.auctionDate = new Date(auctionDate);
      if (matchStartDate) existing.matchStartDate = new Date(matchStartDate);
      if (matchEndDate) existing.matchEndDate = new Date(matchEndDate);
      if (lotA) existing.lotA = lotA;
      if (lotB) existing.lotB = lotB;
      if (lotADay) existing.lotADay = Number(lotADay);
      if (lotBDay) existing.lotBDay = Number(lotBDay);
      if (venue) existing.venue = venue;
      tournament = await existing.save();
    } else {
      // Create new tournament
      tournament = await Tournament.create({
        auctionDate: new Date(auctionDate),
        matchStartDate: matchStartDate ? new Date(matchStartDate) : null,
        matchEndDate: matchEndDate ? new Date(matchEndDate) : null,
        lotA: lotA || 'Lot A',
        lotB: lotB || 'Lot B',
        lotADay: Number(lotADay) || 1,
        lotBDay: Number(lotBDay) || 2,
        venue: venue || 'जुगाइदेवी स्टेडियम उरूल',
        isActive: true
      });
    }

    res.status(201).json(tournament);
  } catch (error) {
    res.status(500).json({ message: 'Failed to save tournament', error: error.message });
  }
};
