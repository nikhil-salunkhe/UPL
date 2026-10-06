import { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerPlayer } from '../../services/playerService';
import './PlayerRegister.css';

const emptyForm = { name: '', role: 'Batsman', team: '', image: null };

const PlayerRegister = () => {
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0] || null;
    setForm((prev) => ({ ...prev, image: file }));
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus({ type: '', message: '' });

    const payload = new FormData();
    payload.append('name', form.name.trim());
    payload.append('role', form.role);
    payload.append('team', form.team.trim());
    if (form.image) payload.append('image', form.image);

    try {
      await registerPlayer(payload);
      setStatus({
        type: 'success',
        message: '✅ Registration submitted! The admin will review and approve it. You will appear in the Players list once approved.'
      });
      setForm(emptyForm);
      setPreview('');
      e.target.reset();
    } catch (error) {
      setStatus({
        type: 'error',
        message: error.response?.data?.message || 'Registration failed. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-shell">
      <section className="register-card">
        <p className="eyebrow">🏏 UPL Village Cup 2026</p>
        <h1>Player Registration</h1>
        <p className="register-sub">
          Fill the form below to register yourself. Your entry goes to the admin for approval first.
        </p>

        {status.message && (
          <div className={`register-alert ${status.type}`}>{status.message}</div>
        )}

        <form className="register-form" onSubmit={handleSubmit}>
          <label>
            Player Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Aarav Singh"
              required
            />
          </label>

          <label>
            Role *
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="All-rounder">All-rounder</option>
              <option value="Wicket-keeper">Wicket-keeper</option>
            </select>
          </label>

          <label>
            Team <span className="optional">(leave blank until auction)</span>
            <input
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
              placeholder="Team (leave blank until auction)"
            />
          </label>

          <label>
            Photo
            <input type="file" accept="image/*" onChange={handleImageChange} />
          </label>
          {preview && <img className="photo-preview" src={preview} alt="preview" />}

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>

        <Link className="back-link" to="/players">← View approved players</Link>
      </section>
    </div>
  );
};

export default PlayerRegister;
