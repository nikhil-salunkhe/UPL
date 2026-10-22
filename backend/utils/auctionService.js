const mongoose = require('mongoose');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Owner = require('../models/Owner');
const AuctionResult = require('../models/AuctionResult');
const {
  isMongoConnected,
  getState,
  setAuctionResult,
  getAuctionByTeam
} = require('../config/fallbackStore');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Ids arrive as ObjectIds (Mongo) or plain strings (fallback store). They are
// always compared as strings so both backends behave identically.
const toIdList = (value) => {
  const source = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]);
  return [...new Set(source.map((id) => String(id ?? '').trim()).filter(Boolean))];
};

const isInvalidMongoId = (id) => !mongoose.isValidObjectId(id);

// The captain and the vice captain are players OF THE SQUAD - never somebody
// from another team. This is the core rule of the auction flow.
const validateAuction = ({ players, captain, viceCaptain }) => {
  if (!players.length) {
    return 'Select at least one player for the squad';
  }
  if (captain && !players.includes(captain)) {
    return 'Captain must be one of the selected squad players';
  }
  if (viceCaptain && !players.includes(viceCaptain)) {
    return 'Vice Captain must be one of the selected squad players';
  }
  if (captain && viceCaptain && captain === viceCaptain) {
    return 'Captain and Vice Captain must be different';
  }
  return null;
};

// ---------------------------------------------------------------------------
// Fallback store (no MongoDB connected)
// ---------------------------------------------------------------------------

const saveAuctionFallback = ({ team, ownerId, players, captain, viceCaptain }) => {
  const state = getState();

  // The squad's players, in the order they were auctioned.
  const squad = players.map((pid) => {
    const player = state.players.find((p) => String(p._id) === pid);
    return player ? { ...player } : { _id: pid, name: 'Player', role: '' };
  });

  // Mirror the auction result onto the team document.
  const teamIndex = state.teams.findIndex((t) => String(t._id) === String(team._id));
  const previousIds = new Set(
    (state.teams[teamIndex].players || []).map((entry) => String(entry.player))
  );
  const teamPlayers = players.map((pid) => ({ player: pid, joinedAt: new Date() }));
  state.teams[teamIndex] = {
    ...state.teams[teamIndex],
    captain: captain || null,
    viceCaptain: viceCaptain || null,
    players: teamPlayers
  };

  // Players that left the squad no longer belong to this team.
  previousIds.forEach((pid) => {
    if (players.includes(pid)) return;
    const player = state.players.find((p) => String(p._id) === pid);
    if (player) {
      player.team = '';
      player.teamId = null;
    }
  });

  // The squad's players now play for this team.
  players.forEach((pid) => {
    const player = state.players.find((p) => String(p._id) === pid);
    if (!player) return;
    player.team = state.teams[teamIndex].name;
    player.teamId = state.teams[teamIndex]._id;
  });

  // Legacy owner records hold the captain / vice-captain as player NAMES.
  const owner = state.owners.find((o) => String(o._id) === String(ownerId));
  if (owner) {
    owner.captain = squad.find((p) => String(p._id) === captain)?.name || '';
    owner.viceCaptain = squad.find((p) => String(p._id) === viceCaptain)?.name || '';
  }

  // One auction result per team - upsert by team.
  const auction = setAuctionResult(team._id, {
    owner: ownerId,
    captain: captain || null,
    viceCaptain: viceCaptain || null,
    players: [...players]
  });

  return { auction, team: state.teams[teamIndex] };
};

// ---------------------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------------------

const saveAuctionMongo = async ({ teamId, ownerId, players, captain, viceCaptain }) => {
  const team = await Team.findById(teamId);
  if (!team) return null;

  // Players that leave the squad must not keep pointing at this team.
  const currentIds = (team.players || []).map((p) => String(p.player));
  const leaving = currentIds.filter((pid) => !players.includes(pid));
  if (leaving.length) {
    await Player.updateMany(
      { _id: { $in: leaving } },
      { $unset: { teamId: 1, team: 1 } }
    );
  }

  // The squad's players now play for this team.
  if (players.length) {
    await Player.updateMany(
      { _id: { $in: players } },
      { $set: { teamId: team._id, team: team.name } }
    );
  }

  // The team document mirrors the auction result.
  team.players = players.map((pid) => ({ player: pid, joinedAt: new Date() }));
  team.captain = captain || null;
  team.viceCaptain = viceCaptain || null;
  await team.save();

  // One auction result per team - upsert.
  const auction = await AuctionResult.findOneAndUpdate(
    { team: team._id },
    {
      $set: {
        team: team._id,
        owner: ownerId,
        captain: captain || null,
        viceCaptain: viceCaptain || null,
        players: players
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // The legacy owner record stores the captain / vice-captain as NAMES.
  const captainName = captain
    ? (await Player.findById(captain).select('name').lean())?.name || ''
    : '';
  const viceCaptainName = viceCaptain
    ? (await Player.findById(viceCaptain).select('name').lean())?.name || ''
    : '';
  await Owner.findByIdAndUpdate(
    ownerId,
    { $set: { captain: captainName, viceCaptain: viceCaptainName } },
    { new: true }
  );

  return { auction, team };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Saves the auction result for a team and synchronizes everything that
 * derives from it: the team roster, the captain, the vice-captain and the
 * players' team assignment.
 *
 * Returns `{ auction, team }` or throws an Error with a user-facing message.
 */
const saveAuction = async ({ teamId, ownerId, players, captain, viceCaptain }) => {
  const squad = toIdList(players);
  const cap = captain ? String(captain).trim() : '';
  const vice = viceCaptain ? String(viceCaptain).trim() : '';

  const error = validateAuction({ players: squad, captain: cap, viceCaptain: vice });
  if (error) throw new Error(error);

  if (!isMongoConnected()) {
    const state = getState();
    const team = state.teams.find((t) => String(t._id) === String(teamId));
    if (!team) return null;
    return saveAuctionFallback({ team, ownerId, players: squad, captain: cap, viceCaptain: vice });
  }

  if (isInvalidMongoId(teamId)) throw new Error('Invalid team id');
  for (const pid of squad) {
    if (isInvalidMongoId(pid)) throw new Error(`Invalid player id: ${pid}`);
  }

  return saveAuctionMongo({
    teamId,
    ownerId,
    players: squad,
    captain: cap || null,
    viceCaptain: vice || null
  });
};

/**
 * Keeps the auction result in step with a roster that was edited through the
 * legacy add/remove endpoint. The auction result stays the single source of
 * truth - it is simply re-derived from the new roster.
 */
const syncAuctionFromRoster = async (team) => {
  const squad = (team.players || []).map((p) => String(p.player)).filter(Boolean);

  // A captain who is no longer in the squad is dropped.
  const captain = team.captain && squad.includes(String(team.captain)) ? String(team.captain) : null;
  const viceCaptain =
    team.viceCaptain && squad.includes(String(team.viceCaptain)) ? String(team.viceCaptain) : null;

  const ownerId = String(team.owner);

  if (!isMongoConnected()) {
    const state = getState();
    const index = state.teams.findIndex((t) => String(t._id) === String(team._id));
    if (index === -1) return null;
    const owner = state.owners.find((o) => String(o._id) === ownerId);
    const nameOf = (pid) => state.players.find((p) => String(p._id) === pid)?.name || '';
    if (owner) {
      owner.captain = captain ? nameOf(captain) : '';
      owner.viceCaptain = viceCaptain ? nameOf(viceCaptain) : '';
    }
    // The team document mirrors the auction result.
    state.teams[index].captain = captain;
    state.teams[index].viceCaptain = viceCaptain;
    return setAuctionResult(team._id, {
      owner: ownerId,
      captain,
      viceCaptain,
      players: [...squad]
    });
  }

  // The team document mirrors the auction result.
  await Team.updateOne(
    { _id: team._id },
    { $set: { captain, viceCaptain } }
  );

  return AuctionResult.findOneAndUpdate(
    { team: team._id },
    {
      $set: { team: team._id, owner: team.owner, captain, viceCaptain, players: squad },
      $setOnInsert: { createdAt: new Date() }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

/** Reads the auction result of one team (null when there is none). */
const getTeamAuction = async (teamId) => {
  if (!isMongoConnected()) {
    return getAuctionByTeam(teamId);
  }
  if (isInvalidMongoId(teamId)) return null;
  return AuctionResult.findOne({ team: teamId }).lean();
};

/**
 * Removes a deleted player from every squad and from the leadership. The
 * auction result must never point at a player that no longer exists.
 *
 * `playerName` is the name the deleted player had, because the legacy owner
 * records store the captain / vice-captain as a NAME. It must be read before
 * the player document is deleted.
 */
const removePlayerFromAuctions = async (playerId, playerName = '') => {
  const pid = String(playerId);

  if (!isMongoConnected()) {
    const state = getState();

    state.auctions.forEach((auction) => {
      const squad = toIdList(auction.players).filter((id) => id !== pid);
      const captain = auction.captain && String(auction.captain) === pid ? null : auction.captain;
      const viceCaptain =
        auction.viceCaptain && String(auction.viceCaptain) === pid ? null : auction.viceCaptain;

      auction.players = squad;
      auction.captain = captain || null;
      auction.viceCaptain = viceCaptain || null;
    });

    // The team documents mirror the auction result. They are cleaned up even
    // when no auction mentioned the player, so no stale reference survives.
    state.teams.forEach((team) => {
      const squad = (team.players || [])
        .map((p) => String(p.player))
        .filter((id) => id !== pid);
      const captain = team.captain && String(team.captain) === pid ? null : team.captain;
      const viceCaptain =
        team.viceCaptain && String(team.viceCaptain) === pid ? null : team.viceCaptain;

      team.players = squad.map((id) => ({ player: id, joinedAt: new Date() }));
      team.captain = captain;
      team.viceCaptain = viceCaptain;
    });

    // The legacy owner records hold the captain / vice-captain as NAMES. A
    // name that no longer belongs to a player is no longer a valid leader.
    state.owners.forEach((owner) => {
      if (owner.captain && !state.players.some((p) => p.name === owner.captain)) owner.captain = '';
      if (owner.viceCaptain && !state.players.some((p) => p.name === owner.viceCaptain)) {
        owner.viceCaptain = '';
      }
      // The squad also stores player NAMES - drop the deleted one from it.
      if (Array.isArray(owner.players) && owner.players.length) {
        owner.players = owner.players.filter((name) => name !== playerName);
      }
    });

    return;
  }

  // In Mongo the ids are ObjectIds - a plain string would never match.
  if (isInvalidMongoId(pid)) return;
  const objectId = new mongoose.Types.ObjectId(pid);

  // The auction result: drop the player from the squad and from the roles.
  await AuctionResult.updateMany({ players: objectId }, { $pull: { players: objectId } });
  await AuctionResult.updateMany({ captain: objectId }, { $set: { captain: null } });
  await AuctionResult.updateMany({ viceCaptain: objectId }, { $set: { viceCaptain: null } });

  // The team documents mirror the auction result.
  await Team.updateMany({}, { $pull: { players: { player: objectId } } });
  await Team.updateMany({ captain: objectId }, { $set: { captain: null } });
  await Team.updateMany({ viceCaptain: objectId }, { $set: { viceCaptain: null } });

  // The legacy owner records hold the captain / vice-captain as NAMES.
  if (playerName) {
    await Owner.updateMany({ captain: playerName }, { $set: { captain: '' } });
    await Owner.updateMany({ viceCaptain: playerName }, { $set: { viceCaptain: '' } });
    // The squad also stores player NAMES - drop the deleted one from it.
    await Owner.updateMany({ players: playerName }, { $pull: { players: playerName } });
  }
};

/**
 * A player rename must follow through to every place that stores the player by
 * NAME: the owner leadership and the owner squad.
 */
const renamePlayerReferences = async (oldName, newName) => {
  const from = (oldName || '').trim();
  const to = (newName || '').trim();
  if (!from || !to || from === to) return;

  if (!isMongoConnected()) {
    const state = getState();
    state.owners.forEach((owner) => {
      if (owner.captain === from) owner.captain = to;
      if (owner.viceCaptain === from) owner.viceCaptain = to;
      if (Array.isArray(owner.players)) {
        owner.players = owner.players.map((name) => (name === from ? to : name));
      }
    });
    return;
  }

  await Owner.updateMany({ captain: from }, { $set: { captain: to } });
  await Owner.updateMany({ viceCaptain: from }, { $set: { viceCaptain: to } });
  // Collect the owners that referenced the old name BEFORE changing anything,
  // then pull the old name and push the new one onto exactly those owners.
  const affected = await Owner.find({ players: from }, { _id: 1 }).lean();
  const affectedIds = affected.map((o) => o._id);
  if (affectedIds.length) {
    await Owner.updateMany({ _id: { $in: affectedIds } }, { $pull: { players: from } });
    await Owner.updateMany({ _id: { $in: affectedIds } }, { $addToSet: { players: to } });
  }
};

/** Reads every auction result. */
const listAuctions = async () => {
  if (!isMongoConnected()) {
    return require('../config/fallbackStore').getAuctions();
  }
  return AuctionResult.find().lean();
};

module.exports = {
  saveAuction,
  syncAuctionFromRoster,
  removePlayerFromAuctions,
  getTeamAuction,
  listAuctions,
  validateAuction,
  toIdList,
  renamePlayerReferences
};

