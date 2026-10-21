import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiBaseUrl, teamImageUrl } from '../../services/api';
import './TeamCard.css';

const getImageSrc = (team) => {
  if (team.logo) {
    if (team.logo.startsWith('data:') || team.logo.startsWith('http')) return team.logo;
    if (team.logo.startsWith('/')) return `${apiBaseUrl}${team.logo}`;
  }
  return team._id ? teamImageUrl(team._id) : '';
};

const TeamCard = ({ team, players = [] }) => {
  const teamPlayers = (team.players || []).map((tp) => players.find((p) => String(p._id) === String(tp.player))).filter(Boolean);
  const [failed, setFailed] = useState(false);
  const logoSrc = getImageSrc(team);

  if (!logoSrc || failed) {
    return (
      <article className="card team-card">
        <div className="team-logo-wrap">
          <span className="team-logo team-logo-fallback">🏆</span>
        </div>
        <div className="card-body">
          <h3>{team.name}</h3>
          <p><strong>Players:</strong> {teamPlayers.length}</p>
          <Link to={`/teams/${team._id}`} className="team-view-btn">View Team →</Link>
        </div>
      </article>
    );
  }

  return (
    <article className="card team-card">
      <div className="team-logo-wrap">
        <img
          className="team-logo"
          src={logoSrc}
          alt={team.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </div>
      <div className="card-body">
        <h3>{team.name}</h3>
        <p><strong>Players:</strong> {teamPlayers.length}</p>
        <Link to={`/teams/${team._id}`} className="team-view-btn">View Team →</Link>
      </div>
    </article>
  );
};

export default TeamCard;
