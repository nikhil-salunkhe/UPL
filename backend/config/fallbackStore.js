const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizeForCompare, imageFingerprint } = require('../utils/registrationGuard');

const createSampleId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const initialState = {
  admin: null,
  players: [],
  owners: [],
  sponsors: [],
  advertisements: [],
  rules: [],
  tournament: null,
  matches: []
};

let store = null;

function initStore() {
  if (store) {
    return store;
  }

  const adminPasswordHash = bcrypt.hashSync('admin123', 10);
  store = {
    ...initialState,
    admin: { username: 'admin', password: adminPasswordHash },
    players: [
      {
        _id: createSampleId('player'),
        name: 'Aarav Singh',
        age: 24,
        role: 'All-rounder',
        team: 'Gulmohar Lions',
        image: ''
      },
      {
        _id: createSampleId('player'),
        name: 'Nikhil Rao',
        age: 28,
        role: 'Bowler',
        team: 'Suryanagar Strikers',
        image: ''
      }
    ],
    owners: [
      {
        _id: createSampleId('owner'),
        name: 'Rahul Mehta',
        phone: '9876543210',
        team: 'Gulmohar Lions',
        captain: 'Aarav Singh',
        viceCaptain: '',
        image: ''
      }
    ],
    sponsors: [
      {
        _id: createSampleId('sponsor'),
        companyName: 'GreenTech Energy',
        sponsoredPrice: '₹50,000',
        phone: '9988776655',
        logo: ''
      }
    ]
  };

  return store;
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function getState() {
  return initStore();
}

function getPlayers() {
  return getState().players;
}

function createPlayer(payload) {
  const player = { _id: createSampleId('player'), ...payload };
  getState().players.unshift(player);
  return player;
}

  // Duplicate guard (mirrors the MongoDB version in playerController.js):
  // same pending name + role, same team when photos mismatch, 10-minute window.
  // Matching store records are returned for retries; new registrations still
  // get a fresh player.
  function findDuplicatePlayer(name, role, payload) {
    const state = getState();
    const now = Date.now();
    return state.players.find((player) => {
      if (player.status !== 'pending') return false;
      if (normalizeForCompare(player.name) !== normalizeForCompare(name)) return false;
      if (normalizeForCompare(player.role) !== normalizeForCompare(role)) return false;

      const playerImage = player.image;
      const incomingImage = payload.image;
      const existingDataUrl = typeof playerImage === 'string' && playerImage.startsWith('data:');
      const incomingDataUrl = typeof incomingImage === 'string' && incomingImage.startsWith('data:');

      if (existingDataUrl && incomingDataUrl) {
        return imageFingerprint(playerImage) === imageFingerprint(incomingImage);
      }
      return normalizeForCompare(player.team) === normalizeForCompare(payload.team);
    }) || null;
  }

function updatePlayer(id, payload) {
  const players = getState().players;
  const index = players.findIndex((player) => player._id === id || player._id?.toString() === id);
  if (index === -1) return null;
  players[index] = { ...players[index], ...payload };
  return players[index];
}

function deletePlayer(id) {
  const players = getState().players;
  const index = players.findIndex((player) => player._id === id || player._id?.toString() === id);
  if (index === -1) return false;
  players.splice(index, 1);
  return true;
}

function getOwners() {
  return getState().owners;
}

function createOwner(payload) {
  const owner = { _id: createSampleId('owner'), ...payload };
  getState().owners.unshift(owner);
  return owner;
}

function updateOwner(id, payload) {
  const owners = getState().owners;
  const index = owners.findIndex((owner) => owner._id === id || owner._id?.toString() === id);
  if (index === -1) return null;
  owners[index] = { ...owners[index], ...payload };
  return owners[index];
}

function deleteOwner(id) {
  const owners = getState().owners;
  const index = owners.findIndex((owner) => owner._id === id || owner._id?.toString() === id);
  if (index === -1) return false;
  owners.splice(index, 1);
  return true;
}

function reorderOwners(orderIds) {
  const state = getState();
  const byId = new Map(state.owners.map((o) => [String(o._id), o]));
  const seen = new Set();
  const reordered = [];
  (orderIds || []).forEach((id, index) => {
    const owner = byId.get(String(id));
    if (owner && !seen.has(String(id))) {
      seen.add(String(id));
      owner.displayOrder = index + 1;
      reordered.push(owner);
    }
  });
  // Append any owners missing from the order list at the end
  state.owners.forEach((owner) => {
    if (!seen.has(String(owner._id))) {
      owner.displayOrder = reordered.length + 1;
      reordered.push(owner);
    }
  });
  state.owners = reordered;
  return state.owners;
}

function getSponsors() {
  return getState().sponsors;
}

function createSponsor(payload) {
  const sponsor = { _id: createSampleId('sponsor'), ...payload };
  getState().sponsors.unshift(sponsor);
  return sponsor;
}

function updateSponsor(id, payload) {
  const sponsors = getState().sponsors;
  const index = sponsors.findIndex((sponsor) => sponsor._id === id || sponsor._id?.toString() === id);
  if (index === -1) return null;
  sponsors[index] = { ...sponsors[index], ...payload };
  return sponsors[index];
}

function deleteSponsor(id) {
  const sponsors = getState().sponsors;
  const index = sponsors.findIndex((sponsor) => sponsor._id === id || sponsor._id?.toString() === id);
  if (index === -1) return false;
  sponsors.splice(index, 1);
  return true;
}

async function verifyAdmin(username, password) {
  const admin = getState().admin;
  if (!admin || admin.username !== username) {
    return null;
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  return isMatch ? admin : null;
}

function getTournament() {
  return getState().tournament || null;
}

function setTournament(payload) {
  const state = getState();
  state.tournament = {
    _id: 'tournament-default',
    ...payload,
    isActive: true,
    createdAt: new Date()
  };
  return state.tournament;
}

function deleteTournament() {
  const state = getState();
  state.tournament = null;
  return true;
}

function getMatches() {
  return getState().matches || [];
}

function createMatch(payload) {
  const match = { _id: createSampleId('match'), ...payload };
  getState().matches.push(match);
  return match;
}

function updateMatch(id, payload) {
  const matches = getState().matches;
  const index = matches.findIndex((m) => m._id === id || m._id?.toString() === id);
  if (index === -1) return null;
  matches[index] = { ...matches[index], ...payload };
  return matches[index];
}

function deleteMatch(id) {
  const matches = getState().matches;
  const index = matches.findIndex((m) => m._id === id || m._id?.toString() === id);
  if (index === -1) return false;
  matches.splice(index, 1);
  return true;
}

module.exports = {
  createSampleId,
  initStore,
  createSampleId,
  isMongoConnected,
  getState,
  getPlayers,
  createPlayer,
  updatePlayer,
  deletePlayer,
  getOwners,
  createOwner,
  updateOwner,
  deleteOwner,
  reorderOwners,
  getSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  verifyAdmin,
  getTournament,
  setTournament,
  deleteTournament,
  getMatches,
  createMatch,
  updateMatch,
  deleteMatch
};
