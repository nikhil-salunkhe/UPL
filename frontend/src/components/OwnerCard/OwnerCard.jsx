import './OwnerCard.css';
import PlayerAvatar from '../PlayerAvatar/PlayerAvatar';
import { apiBaseUrl } from '../../services/api';

const OwnerCard = ({ owner, players = [] }) => {
  const getImageSrc = (image) => {
    if (!image) {
      return 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80';
    }
    if (image.startsWith('data:')) return image;
    return image.startsWith('http') ? image : `${apiBaseUrl}${image.startsWith('/') ? image : `/${image}`}`;
  };

  const findPlayer = (name) => players.find((player) => player.name === name);

  const renderLeader = (name) => {
    if (!name) {
      return <span className="leader-empty">TBD</span>;
    }
    return (
      <span className="player-cell">
        <PlayerAvatar player={findPlayer(name)} name={name} size={28} />
        {name}
      </span>
    );
  };

  return (
    <article className="card owner-card">
      <img src={getImageSrc(owner.image)} alt={owner.name} />
      <div className="card-body">
        <h3>{owner.name}</h3>
        <p><strong>Team:</strong> {owner.team || 'Auction Pending'}</p>
        <p><strong>Captain:</strong> {renderLeader(owner.captain)}</p>
        <p><strong>Vice Captain:</strong> {renderLeader(owner.viceCaptain)}</p>
        <p><strong>Phone:</strong> {owner.phone}</p>
      </div>
    </article>
  );
};

export default OwnerCard;
