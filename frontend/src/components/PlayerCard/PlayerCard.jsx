import './PlayerCard.css';
import { apiBaseUrl } from '../../services/api';

const getImageSrc = (player) => {
  if (!player.image) {
    return 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=600&q=80';
  }
  if (player.image.startsWith('http')) {
    return player.image;
  }
  return `${apiBaseUrl}${player.image.startsWith('/') ? player.image : `/${player.image}`}`;
};

const PlayerCard = ({ player }) => {
  return (
    <article className="card player-card">
      <img src={getImageSrc(player)} alt={player.name} />
      <div className="card-body">
        <h3>{player.name}</h3>
        <p><strong>Role:</strong> {player.role}</p>
        <p><strong>Age:</strong> {player.age}</p>
        <p><strong>Jersey:</strong> #{player.jerseyNumber}</p>
        <p><strong>Team:</strong> {player.team || 'Auction Pending'}</p>
      </div>
    </article>
  );
};

export default PlayerCard;
