import { useEffect, useMemo, useState } from 'react';
import { getOwners } from '../../services/ownerService';
import { getPlayers } from '../../services/playerService';
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar';
import PhotoPreview from '../../components/PhotoPreview/PhotoPreview';
import { apiBaseUrl, ownerImageUrl } from '../../services/api';
import './Owners.css';

const getImageSrc = (owner) => {
  // The list endpoint no longer embeds the base64 photo (it made the response
  // ~4 MB and timed out). Load each owner photo on demand from its id. Older or
  // admin responses may still carry an inline data URL / path — honour those.
  if (owner.image) {
    if (owner.image.startsWith('data:') || owner.image.startsWith('http')) {
      return owner.image;
    }
    if (owner.image.startsWith('/')) {
      return `${apiBaseUrl}${owner.image}`;
    }
  }
  return owner._id ? ownerImageUrl(owner._id) : '';
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
  const [previewOwner, setPreviewOwner] = useState(null);

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
              {[...owners]
                .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0))
                .map((owner) => (
                <tr key={owner._id}>
                  <td className="img-cell">
                    <button
                      type="button"
                      className="img-preview-btn"
                      onClick={() => setPreviewOwner(owner)}
                      aria-label={`View ${owner.name} photo`}
                    >
                      <img
                        src={getImageSrc(owner)}
                        alt={owner.name}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                      />
                    </button>
                  </td>
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

      {previewOwner && (
        <PhotoPreview
          src={getImageSrc(previewOwner)}
          alt={previewOwner.name}
          onClose={() => setPreviewOwner(null)}
        />
      )}
    </div>
  );
};

export default Owners;
