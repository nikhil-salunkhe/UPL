import { useEffect, useMemo, useState } from 'react';
import { getPlayers } from '../../services/playerService';
import './Players.css';

import { apiBaseUrl } from '../../services/api';

const getImageSrc = (player) => {
  if (!player.image) {
    return 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80';
  }
  if (player.image.startsWith('http')) {
    return player.image;
  }
  return `${apiBaseUrl}${player.image.startsWith('/') ? player.image : `/${player.image}`}`;
};

const Players = () => {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [team, setTeam] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const data = await getPlayers();
        setPlayers(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, []);

  const teams = useMemo(() => ['All', ...new Set(players.map((player) => player.team).filter(Boolean))], [players]);

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase());
      const matchesTeam = team === 'All' || player.team === team;
      return matchesSearch && matchesTeam;
    });
  }, [players, search, team]);

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
              {filteredPlayers.map((player) => (
                <tr key={player._id}>
                  <td className="img-cell"><img src={getImageSrc(player)} alt={player.name} /></td>
                  <td>{player.name}</td>
                  <td>{player.role}</td>
                  <td>{player.age}</td>
                  <td>{player.team || 'Auction Pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Players;
