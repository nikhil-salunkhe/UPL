import './OwnerCard.css';
import { apiBaseUrl } from '../../services/api';

const OwnerCard = ({ owner }) => {
  const getImageSrc = (image) => {
    if (!image) {
      return 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=600&q=80';
    }
    return image.startsWith('http') ? image : `${apiBaseUrl}${image.startsWith('/') ? image : `/${image}`}`;
  };

  return (
    <article className="card owner-card">
      <img src={getImageSrc(owner.image)} alt={owner.name} />
      <div className="card-body">
        <h3>{owner.name}</h3>
        <p><strong>Team:</strong> {owner.team || 'Auction Pending'}</p>
        <p><strong>Phone:</strong> {owner.phone}</p>
      </div>
    </article>
  );
};

export default OwnerCard;
