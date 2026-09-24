import './PlayerAvatar.css';
import { apiBaseUrl } from '../../services/api';

const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const PlayerAvatar = ({ player, name, size = 32 }) => {
  const displayName = (player?.name || name || '').trim();
  const image = player?.image;
  const style = { width: `${size}px`, height: `${size}px` };

  if (image) {
    const src = image.startsWith('http') ? image : `${apiBaseUrl}${image.startsWith('/') ? image : `/${image}`}`;
    return <img className="player-avatar" src={src} alt={displayName} style={style} />;
  }

  return (
    <span
      className="player-avatar player-avatar-fallback"
      style={{ ...style, fontSize: `${Math.max(Math.round(size * 0.36), 10)}px` }}
      title={displayName}
    >
      {displayName ? getInitials(displayName) : '?'}
    </span>
  );
};

export default PlayerAvatar;