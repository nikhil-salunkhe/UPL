import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTeam } from '../../services/teamService';
import { playerImageUrl, teamImageUrl } from '../../services/api';
import PhotoPreview from '../../components/PhotoPreview/PhotoPreview';
import { apiBaseUrl } from '../../services/api';
import './TeamDetail.css';

const getImageSrc = (team) => {
  if (team.logo) {
    if (team.logo.startsWith('data:') || team.logo.startsWith('http')) return team.logo;
    if (team.logo.startsWith('/')) return `${apiBaseUrl}${team.logo}`;
  }
  return team._id ? teamImageUrl(team._id) : '';
};

const TeamDetail = () => {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewPlayer, setPreviewPlayer] = useState(null);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const data = await getTeam(id);
        setTeam(data);
        setPlayers(data.players || []);
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

  const logoSrc = getImageSrc(team);
  const playersWithPhotos = players.map((p) => ({
    ...p,
    imageSrc: p.image
      ? (p.image.startsWith('data:') || p.image.startsWith('http') ? p.image : (p.image.startsWith('/') ? `${apiBaseUrl}${p.image}` : p.image))
      : (p._id ? playerImageUrl(p._id) : 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=200&q=80')
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

      <section className="team-header">
        <div className="team-logo-wrap">
          {logoSrc ? (
            <img className="team-logo" src={logoSrc} alt={team.name} loading="lazy" onError={() => {}} />
          ) : (
            <span className="team-logo team-logo-fallback">🏆</span>
          )}
        </div>
        <div className="team-info">
          <h1>{team.name}</h1>
          <p><strong>Players:</strong> {players.length}</p>
          <p><strong>Owner:</strong> {team.owner || '—'}</p>
        </div>
      </section>

      <section className="players-section">
        <h2>Players</h2>
        {playersWithPhotos.length === 0 ? (
          <div className="status-card">No players in this team yet.</div>
        ) : (
          <div className="players-grid">
            {playersWithPhotos.map((player) => (
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
                  <h3>{player.name}</h3>
                  <p><strong>Role:</strong> {player.role}</p>
                  {player.age != null && <p><strong>Age:</strong> {player.age}</p>}
                  <p><strong>Phone:</strong> {player.phone || '—'}</p>
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
