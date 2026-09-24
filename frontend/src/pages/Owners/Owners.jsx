import { useEffect, useMemo, useState } from 'react';
import { getOwners } from '../../services/ownerService';
import { getPlayers } from '../../services/playerService';
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar';
import { apiBaseUrl } from '../../services/api';
import './Owners.css';

const getImageSrc = (owner) => {
  if (!owner.image) {
    return 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=80';
  }
  if (owner.image.startsWith('data:') || owner.image.startsWith('http')) {
    return owner.image;
  }
  return `${apiBaseUrl}${owner.image.startsWith('/') ? owner.image : `/${owner.image}`}`;
};

const cleanLeaderName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/^(data|blob|https?):/i.test(trimmed) || trimmed.length > 80) return '';
  return trimmed;
};

const Owners = () => {
  const [owners, setOwners] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  const playersByName = useMemo(
    () => Object.fromEntries(players.map((player) => [player.name, player])),
    [players]
  );

  useEffect(() => {
    const loadOwners = async () => {
      try {
        const [ownerData, playerData] = await Promise.all([getOwners(), getPlayers()]);
        setOwners(ownerData);
        setPlayers(playerData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadOwners();
  }, []);

  const renderLeader = (name) => {
    const clean = cleanLeaderName(name);
    if (!clean) {
      return <span className="leader-empty">TBD</span>;
    }
    return (
      <span className="player-cell">
        <PlayerAvatar player={playersByName[clean]} name={clean} size={32} />
        {clean}
      </span>
    );
  };

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Community Backbone</p>
          <h1>Owners</h1>
        </div>
      </section>

      {loading ? (
        <div className="status-card">Loading owners...</div>
      ) : owners.length === 0 ? (
        <div className="status-card">No owners available yet.</div>
      ) : (
        <div className="owners-table-container">
          <table className="owners-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Team</th>
                <th>Captain</th>
                <th>Vice Captain</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner._id}>
                  <td className="img-cell"><img src={getImageSrc(owner)} alt={owner.name} /></td>
                  <td>{owner.name}</td>
                  <td>{owner.team || <span className="team-pending">—</span>}</td>
                  <td>{owner.captain ? renderLeader(owner.captain) : <span className="leader-empty">TBD</span>}</td>
                  <td>{owner.viceCaptain ? renderLeader(owner.viceCaptain) : <span className="leader-empty">TBD</span>}</td>
                  <td>{owner.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Owners;
