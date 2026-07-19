const Match = require('../models/Match');
const { isMongoConnected, getMatches, createMatch, updateMatch, deleteMatch } = require('../config/fallbackStore');

exports.getMatches = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json(getMatches());
    }
    const matches = await Match.find().sort({ matchDate: 1, matchTime: 1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch matches', error: error.message });
  }
};

exports.createMatch = async (req, res) => {
  try {
    const { teamA, teamB, matchDate, matchTime, lot, venue } = req.body;

    if (!teamA || !teamB || !matchDate) {
      return res.status(400).json({ message: 'Team A, Team B, and match date are required' });
    }

    const payload = {
      teamA,
      teamB,
      matchDate: new Date(matchDate),
      matchTime: matchTime || '10:00 AM',
      lot: lot || 'Lot A',
      venue: venue || 'जुगाइदेवी स्टेडियम उरूल'
    };

    if (!isMongoConnected()) {
      const match = createMatch(payload);
      return res.status(201).json(match);
    }

    const match = await Match.create(payload);
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create match', error: error.message });
  }
};

exports.updateMatch = async (req, res) => {
  try {
    const { teamA, teamB, matchDate, matchTime, lot, venue, status } = req.body;

    const updateData = {};
    if (teamA) updateData.teamA = teamA;
    if (teamB) updateData.teamB = teamB;
    if (matchDate) updateData.matchDate = new Date(matchDate);
    if (matchTime) updateData.matchTime = matchTime;
    if (lot) updateData.lot = lot;
    if (venue) updateData.venue = venue;
    if (status) updateData.status = status;

    if (!isMongoConnected()) {
      const match = updateMatch(req.params.id, updateData);
      if (!match) return res.status(404).json({ message: 'Match not found' });
      return res.json(match);
    }

    const match = await Match.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update match', error: error.message });
  }
};

exports.deleteMatch = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      const deleted = deleteMatch(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Match not found' });
      return res.json({ message: 'Match deleted' });
    }

    const match = await Match.findByIdAndDelete(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete match', error: error.message });
  }
};