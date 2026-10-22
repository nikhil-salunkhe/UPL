import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiBaseUrl, teamImageUrl } from '../../services/api';
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar';
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
  const captain = players.find((p) => String(p._id) === String(team.captain));
  const viceCaptain = players.find((p) => String(p._id) === String(team.viceCaptain));
  const [failed, setFailed] = useState(false);
  const logoSrc = getImageSrc(team);

  const renderLeader = (label, player) => {
    if (!player) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
        <PlayerAvatar player={player} name={player.name} size={24} />
        <span><strong>{label}:</strong> {player.name}</span>
      </div>
    );
  };

  if (!logoSrc || failed) {
    return (
      <article className="card team-card">
        <div className="team-logo-wrap">
          <span className="team-logo team-logo-fallback">🏆</span>
        </div>
        <div className="card-body">
          <h3>{team.name}</h3>
          <p><strong>Players:</strong> {teamPlayers.length}</p>
          {renderLeader('Captain', captain)}
          {renderLeader('Vice Captain', viceCaptain)}
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
        {renderLeader('Captain', captain)}
        {renderLeader('Vice Captain', viceCaptain)}
        <Link to={`/teams/${team._id}`} className="team-view-btn">View Team →</Link>
      </div>
    </article>
  );
};

export default TeamCard;
