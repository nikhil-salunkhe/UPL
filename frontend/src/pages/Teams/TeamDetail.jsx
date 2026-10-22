import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam } from '../../services/teamService';
import { getOwners } from '../../services/ownerService';
import { playerImageUrl, ownerImageUrl } from '../../services/api';
import PhotoPreview from '../../components/PhotoPreview/PhotoPreview';
import { apiBaseUrl } from '../../services/api';
import './TeamDetail.css';

const getOwnerImageSrc = (owner) => {
  if (!owner) return '';
  if (owner.image) {
    if (owner.image.startsWith('data:') || owner.image.startsWith('http')) return owner.image;
    if (owner.image.startsWith('/')) return `${apiBaseUrl}${owner.image}`;
  }
  return owner._id ? ownerImageUrl(owner._id) : '';
};

const getPlayerImageSrc = (player) => {
  if (!player) return '';
  if (player.image) {
    if (player.image.startsWith('data:') || player.image.startsWith('http')) return player.image;
    if (player.image.startsWith('/')) return `${apiBaseUrl}${player.image}`;
  }
  return player._id ? playerImageUrl(player._id) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80';
};

const TeamDetail = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewPlayer, setPreviewPlayer] = useState(null);
  const [previewOwner, setPreviewOwner] = useState(null);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const [data, ownerData] = await Promise.all([getTeam(id), getOwners()]);
        setTeam(data);
        setPlayers(data.players || []);
        setOwners(Array.isArray(ownerData) ? ownerData : ownerData?.data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadTeam();
  }, [id]);

  const handleImageError = (event) => {
    const img = event.currentTarget;
    img.onerror = null;
    img.src = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80';
  };

  if (loading) {
    return <div className="status-card">Loading team...</div>;
  }

  if (!team) {
    return <div className="status-card">Team not found.</div>;
  }

  const owner = owners.find((o) => String(o._id) === String(team.owner));
  const playerMap = new Map(players.map((p) => [String(p._id), p]));
  const captain = playerMap.get(String(team.captain)) || null;
  const viceCaptain = playerMap.get(String(team.viceCaptain)) || null;
  const leaderIds = new Set([String(team.captain || ''), String(team.viceCaptain || '')].filter(Boolean));
  const squadPlayers = players.filter((p) => !leaderIds.has(String(p._id)));

  const playersWithPhotos = (list) =>
    list.map((p) => ({
      ...p,
      imageSrc: getPlayerImageSrc(p),
    }));

  return (
    <div className="page-shell">
      {previewPlayer && (
        <PhotoPreview
          src={previewPlayer.imageSrc}
          alt={previewPlayer.name}
          onClose={() => setPreviewPlayer(null)}
          onError={handleImageError}
        />
      )}
      {previewOwner && (
        <PhotoPreview
          src={getOwnerImageSrc(previewOwner)}
          alt={previewOwner.name}
          onClose={() => setPreviewOwner(null)}
          onError={handleImageError}
        />
      )}

      <section className="team-header">
        <div className="info-box team-box">
          <h1>{team.name}</h1>
          <p><strong>Players:</strong> {players.length}</p>
        </div>
        {owner ? (
          <div className="info-box owner-box">
            <button
              type="button"
              className="owner-preview-btn"
              onClick={() => setPreviewOwner(owner)}
              aria-label={`View ${owner.name} photo`}
            >
              <img
                className="owner-mini-photo"
                src={getOwnerImageSrc(owner)}
                alt={owner.name}
                loading="lazy"
                onError={handleImageError}
              />
            </button>
            <div className="owner-details">
              <p><strong>Owner:</strong> {owner.name}</p>
              {owner.phone && <p><strong>Phone:</strong> {owner.phone}</p>}
              {owner.team && <p><strong>Owner Team:</strong> {owner.team}</p>}
            </div>
          </div>
        ) : (
          <div className="info-box owner-box">
            <p><strong>Owner:</strong> {team.owner ? String(team.owner) : '�'}</p>
          </div>
        )}
      </section>

      {(captain || viceCaptain) && (
        <section className="leadership-section">
          <h2>Captain &amp; Vice Captain</h2>
          <div className="leaders-grid">
            {captain && (
              <article className="leader-card" onClick={() => setPreviewPlayer({ ...captain, imageSrc: getPlayerImageSrc(captain) })} role="button" tabIndex={0}>
                <img src={getPlayerImageSrc(captain)} alt={captain.name} loading="lazy" onError={handleImageError} />
                <div className="card-body">
                  <span className="leader-badge">Captain</span>
                  <h3>{captain.name}</h3>
                  <p><strong>Role:</strong> {captain.role}</p>
                  {captain.age != null && <p><strong>Age:</strong> {captain.age}</p>}
                  {captain.team && <p><strong>Team:</strong> {captain.team}</p>}
                </div>
              </article>
            )}
            {viceCaptain && (
              <article className="leader-card" onClick={() => setPreviewPlayer({ ...viceCaptain, imageSrc: getPlayerImageSrc(viceCaptain) })} role="button" tabIndex={0}>
                <img src={getPlayerImageSrc(viceCaptain)} alt={viceCaptain.name} loading="lazy" onError={handleImageError} />
                <div className="card-body">
                  <span className="leader-badge" vice>Vice Captain</span>
                  <h3>{viceCaptain.name}</h3>
                  <p><strong>Role:</strong> {viceCaptain.role}</p>
                  {viceCaptain.age != null && <p><strong>Age:</strong> {viceCaptain.age}</p>}
                  {viceCaptain.team && <p><strong>Team:</strong> {viceCaptain.team}</p>}
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      <section className="players-section">
        <h2>Squad</h2>
        {squadPlayers.length === 0 && !captain && !viceCaptain ? (
          <div className="status-card">No players in this team yet.</div>
        ) : squadPlayers.length === 0 ? (
          <div className="status-card">No additional squad players.</div>
        ) : (
          <div className="players-grid">
            {playersWithPhotos(squadPlayers).map((player, index) => (
              <article
                key={player._id}
                className="player-card"
                onClick={() => setPreviewPlayer(player)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setPreviewPlayer(player)}
              >
                <img
                  src={player.imageSrc}
                  alt={player.name}
                  loading="lazy"
                  onError={handleImageError}
                />
                <div className="card-body">
                  <span className="player-number">{index + 1}</span>
                  <h3>{player.name}</h3>
                  <p><strong>Role:</strong> {player.role}</p>
                  {player.age != null && <p><strong>Age:</strong> {player.age}</p>}
                  {player.team && <p><strong>Team:</strong> {player.team}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TeamDetail;
