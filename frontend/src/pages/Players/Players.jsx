import { useEffect, useMemo, useState } from 'react';
import { getPlayers } from '../../services/playerService';
import { getOwners } from '../../services/ownerService';
import './Players.css';

import { apiBaseUrl } from '../../services/api';

const getImageSrc = (player) => {
  if (!player.image) {
    return 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80';
  }
  if (player.image.startsWith('data:') || player.image.startsWith('http')) {
    return player.image;
  }
  return `${apiBaseUrl}${player.image.startsWith('/') ? player.image : `/${player.image}`}`;
};

// Captain / vice-captain are player NAMES — guard against corrupted records
// where an image data URL ended up in these fields.
const cleanLeaderName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/^(data|blob|https?):/i.test(trimmed) || trimmed.length > 80) return '';
  return trimmed;
};

// Before the auction, captain/vice-captain are already decided on the owner
// record — derive their team from it instead of showing "Auction Pending".
const getPlayerTeam = (player, owners) => {
  if (player.team) return player.team;
  const owner = owners.find(
    (o) => cleanLeaderName(o.captain) === player.name || cleanLeaderName(o.viceCaptain) === player.name
  );
  return owner?.team || '';
};

const getLeaderBadge = (player, owners) => {
  if (owners.some((o) => cleanLeaderName(o.captain) === player.name)) {
    return { label: 'C', className: 'captain-badge' };
  }
  if (owners.some((o) => cleanLeaderName(o.viceCaptain) === player.name)) {
    return { label: 'VC', className: 'vice-badge' };
  }
  return null;
};

const Players = () => {
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const [playerData, ownerData] = await Promise.all([getPlayers(), getOwners()]);
        setPlayers(playerData);
        setOwners(ownerData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, []);

  const teams = useMemo(
    () => ['All', ...new Set(players.map((player) => getPlayerTeam(player, owners)).filter(Boolean))],
    [players, owners]
  );

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase());
      const matchesTeam = team === 'All' || getPlayerTeam(player, owners) === team;
      return matchesSearch && matchesTeam;
    });
  }, [players, owners, search, team]);

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Team Profiles</p>
          <h1>Players</h1>
        </div>
        <div className="filter-row">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player name" />
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            {teams.map((item) => (
              <option key={item} value={item}>{item || 'Unassigned'}</option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="status-card">Loading players...</div>
      ) : filteredPlayers.length === 0 ? (
        <div className="status-card">No players match your search.</div>
      ) : (
        <div className="players-table-container">
          <table className="players-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Role</th>
                <th>Age</th>
                <th>Team</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => {
                const badge = getLeaderBadge(player, owners);
                const displayTeam = getPlayerTeam(player, owners);

                return (
                  <tr key={player._id}>
                    <td className="img-cell"><img src={getImageSrc(player)} alt={player.name} /></td>
                    <td>
                      <span className="player-name">
                        <span className="player-name-text">{player.name}</span>
                        {badge && <span className={badge.className}>{badge.label}</span>}
                      </span>
                    </td>
                    <td>{player.role}</td>
                    <td>{player.age ?? '—'}</td>
                    <td>{displayTeam || <span className="team-pending">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Players;
