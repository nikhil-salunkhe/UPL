import { useState } from 'react';
import './PlayerAvatar.css';
import { apiBaseUrl, playerImageUrl } from '../../services/api';

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
  // List responses no longer embed photos — build the on-demand URL from the
  // player id. If the photo turns out to be missing (404), fall back to initials.
  // Track WHICH avatar failed (not a boolean) so switching players resets it
  // without needing an effect.
  const avatarId = player?._id || 'inline';
  const [failedId, setFailedId] = useState(null);

  const inlineImage = player?.image || '';
  const image = failedId === avatarId ? '' : inlineImage || (player?._id ? playerImageUrl(player._id) : '');
  const style = { width: `${size}px`, height: `${size}px` };

  if (image) {
    const src = image.startsWith('data:') || image.startsWith('http')
      ? image
      : `${apiBaseUrl}${image.startsWith('/') ? image : `/${image}`}`;
    return (
      <img
        className="player-avatar"
        src={src}
        alt={displayName}
        style={style}
        loading="lazy"
        onError={() => setFailedId(avatarId)}
      />
    );
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