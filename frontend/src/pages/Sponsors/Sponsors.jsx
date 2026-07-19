import { useEffect, useState } from 'react';
import { getSponsors } from '../../services/sponsorService';
import { apiBaseUrl } from '../../services/api';
import './Sponsors.css';

const getImageSrc = (sponsor) => {
  if (!sponsor.logo) {
    return 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=200&q=80';
  }
  if (sponsor.logo.startsWith('http')) {
    return sponsor.logo;
  }
  return `${apiBaseUrl}${sponsor.logo.startsWith('/') ? sponsor.logo : `/${sponsor.logo}`}`;
};

const Sponsors = () => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSponsors = async () => {
      try {
        const data = await getSponsors();
        setSponsors(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadSponsors();
  }, []);

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Supporters</p>
          <h1>Sponsors</h1>
        </div>
      </section>

      {loading ? (
        <div className="status-card">Loading sponsors...</div>
      ) : sponsors.length === 0 ? (
        <div className="status-card">No sponsors available yet.</div>
      ) : (
        <div className="sponsors-table-container">
          <table className="sponsors-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Sponsor Name</th>
                <th>Price</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((sponsor) => (
                <tr key={sponsor._id}>
                  <td className="img-cell"><img src={getImageSrc(sponsor)} alt={sponsor.companyName} /></td>
                  <td>{sponsor.companyName || sponsor.sponsorName || sponsor.name}</td>
                  <td>{sponsor.sponsoredPrice || 'Not shared'}</td>
                  <td>{sponsor.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Sponsors;
