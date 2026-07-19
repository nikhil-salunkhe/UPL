import './SponsorCard.css';
import { apiBaseUrl } from '../../services/api';

const SponsorCard = ({ sponsor }) => {
  const getImageSrc = (image) => {
    if (!image) {
      return 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=600&q=80';
    }
    return image.startsWith('http') ? image : `${apiBaseUrl}${image.startsWith('/') ? image : `/${image}`}`;
  };

  return (
    <article className="card sponsor-card">
      <img src={getImageSrc(sponsor.logo)} alt={sponsor.companyName} />
      <div className="card-body">
        <h3>{sponsor.companyName}</h3>
        <p><strong>Sponsored Price:</strong> {sponsor.sponsoredPrice || 'Not shared'}</p>
        <p><strong>Contact:</strong> {sponsor.phone}</p>
      </div>
    </article>
  );
};

export default SponsorCard;
