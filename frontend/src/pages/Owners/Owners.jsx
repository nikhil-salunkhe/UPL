import { useEffect, useState } from 'react';
import { getOwners } from '../../services/ownerService';
import { apiBaseUrl } from '../../services/api';
import './Owners.css';

const getImageSrc = (owner) => {
  if (!owner.image) {
    return 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=80';
  }
  if (owner.image.startsWith('http')) {
    return owner.image;
  }
  return `${apiBaseUrl}${owner.image.startsWith('/') ? owner.image : `/${owner.image}`}`;
};

const Owners = () => {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOwners = async () => {
      try {
        const data = await getOwners();
        setOwners(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadOwners();
  }, []);

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Community Backbone</p>
          <h1>Owners</h1>
        </div>
      </section>

      {loading ? (
        <div className="status-card">Loading owners...</div>
      ) : owners.length === 0 ? (
        <div className="status-card">No owners available yet.</div>
      ) : (
        <div className="owners-table-container">
          <table className="owners-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Team</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner._id}>
                  <td className="img-cell"><img src={getImageSrc(owner)} alt={owner.name} /></td>
                  <td>{owner.name}</td>
                  <td>{owner.team || 'Auction Pending'}</td>
                  <td>{owner.phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Owners;
