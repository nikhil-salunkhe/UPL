import { useEffect, useState } from 'react';
import { getSponsors } from '../../services/sponsorService';
import PhotoPreview from '../../components/PhotoPreview/PhotoPreview';
import { apiBaseUrl, sponsorImageUrl } from '../../services/api';
import './Sponsors.css';

const getImageSrc = (sponsor) => {
  // The list endpoint no longer embeds the base64 logo. Load each logo on
  // demand from its id. Honour any inline data URL / path from older responses.
  if (sponsor.logo) {
    if (sponsor.logo.startsWith('data:') || sponsor.logo.startsWith('http')) {
      return sponsor.logo;
    }
    if (sponsor.logo.startsWith('/')) {
      return `${apiBaseUrl}${sponsor.logo}`;
    }
  }
  return sponsor._id ? sponsorImageUrl(sponsor._id) : '';
};

const Sponsors = () => {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewSponsor, setPreviewSponsor] = useState(null);

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
                  <td className="img-cell">
                    <button
                      type="button"
                      className="img-preview-btn"
                      onClick={() => setPreviewSponsor(sponsor)}
                      aria-label={`View ${sponsor.companyName || sponsor.sponsorName || sponsor.name} photo`}
                    >
                      <img src={getImageSrc(sponsor)} alt={sponsor.companyName || sponsor.sponsorName || sponsor.name} loading="lazy" />
                    </button>
                  </td>
                  <td>{sponsor.companyName || sponsor.sponsorName || sponsor.name}</td>
                  <td>{sponsor.sponsoredPrice || 'Not shared'}</td>
                  <td>{sponsor.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {previewSponsor && (
        <PhotoPreview
          src={getImageSrc(previewSponsor)}
          alt={previewSponsor.companyName || previewSponsor.sponsorName || previewSponsor.name}
          onClose={() => setPreviewSponsor(null)}
        />
      )}
    </div>
  );
};

export default Sponsors;
