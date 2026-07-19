const Player = require('../models/Player');
const { isMongoConnected, getPlayers: getStorePlayers, createPlayer: createStorePlayer, updatePlayer: updateStorePlayer, deletePlayer: deleteStorePlayer } = require('../config/fallbackStore');

exports.getPlayers = async (req, res) => {
  try {
    if (!isMongoConnected()) {
      return res.json(getStorePlayers());
    }
    const players = await Player.find().sort({ createdAt: -1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch players', error: error.message });
  }
};

exports.createPlayer = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      age: Number(req.body.age),
      role: req.body.role,
      team: req.body.team || '',
      image: req.file ? `/uploads/${req.file.filename}` : ''
    };

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
      age: Number(req.body.age),
      role: req.body.role,
      team: req.body.team || ''
    };

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
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
