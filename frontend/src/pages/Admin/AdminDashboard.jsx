import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { createPlayer, deletePlayer, getPlayers, updatePlayer } from '../../services/playerService';
import { createOwner, deleteOwner, getOwners, updateOwner } from '../../services/ownerService';
import { createSponsor, deleteSponsor, getSponsors, updateSponsor } from '../../services/sponsorService';
import { getTournament, saveTournament } from '../../services/tournamentService';
import { getMatches, createMatch, updateMatch, deleteMatch } from '../../services/matchService';
import './Admin.css';

const emptyPlayer = { name: '', age: '', role: 'Batsman', team: '', image: '' };
const emptyOwner = { name: '', phone: '', team: '', image: '' };
const emptySponsor = { companyName: '', sponsoredPrice: '', phone: '', logo: '' };
const emptyTournament = { auctionDate: '', matchStartDate: '', matchEndDate: '', lotA: 'Lot A', lotB: 'Lot B', lotADay: 1, lotBDay: 2, venue: 'जुगाइदेवी स्टेडियम उरूल' };
const emptyMatch = { teamA: '', teamB: '', matchDate: '', matchTime: '10:00 AM', lot: 'Lot A', venue: 'जुगाइदेवी स्टेडियम उरूल' };

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [matches, setMatches] = useState([]);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [ownerForm, setOwnerForm] = useState(emptyOwner);
  const [sponsorForm, setSponsorForm] = useState(emptySponsor);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingOwnerId, setEditingOwnerId] = useState(null);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [tournamentData, setTournamentData] = useState(null);
  const [matchForm, setMatchForm] = useState(emptyMatch);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [playerData, ownerData, sponsorData] = await Promise.all([getPlayers(), getOwners(), getSponsors()]);
      setPlayers(playerData);
      setOwners(ownerData);
      setSponsors(sponsorData);
    } catch (error) {
      console.error(error);
    }
  };

  const loadMatches = async () => {
    try {
      const data = await getMatches();
      setMatches(data);
    } catch (error) {
      console.error(error);
    }
  };

  const toDateInputValue = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  const loadTournament = async () => {
    try {
      const data = await getTournament();
      setTournamentData(data);
      if (data) {
        setTournamentForm({
          auctionDate: toDateInputValue(data.auctionDate),
          matchStartDate: toDateInputValue(data.matchStartDate),
          matchEndDate: toDateInputValue(data.matchEndDate),
          lotA: data.lotA || 'Lot A',
          lotB: data.lotB || 'Lot B',
          lotADay: data.lotADay || 1,
          lotBDay: data.lotBDay || 2,
          venue: data.venue || 'जुगाइदेवी स्टेडियम उरूल'
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    loadData();
    loadTournament();
    loadMatches();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handlePlayerSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();
    Object.entries(playerForm).forEach(([key, value]) => {
      if (key === 'image') {
        if (value) payload.append('image', value);
      } else {
        payload.append(key, value);
      }
    });
    try {
      if (editingPlayerId) {
        await updatePlayer(editingPlayerId, payload);
      } else {
        await createPlayer(payload);
      }
      setMessage('Player saved successfully');
      setPlayerForm(emptyPlayer);
      setEditingPlayerId(null);
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save player');
    }
  };

  const handleTournamentSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveTournament(tournamentForm);
      const hasMatchDates = tournamentForm.matchStartDate && tournamentForm.matchEndDate;
      setMessage(hasMatchDates ? 'Tournament details saved successfully' : 'Auction date saved successfully');
      loadTournament();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save tournament');
    }
  };

  const handleDeleteTournament = async () => {
    if (!window.confirm('Delete tournament entirely? This cannot be undone.')) return;
    try {
      await api.delete('/tournament');
      setMessage('Tournament deleted');
      setTournamentData(null);
      setTournamentForm(emptyTournament);
    } catch (error) {
      setMessage('Failed to delete tournament');
    }
  };

  const handleMatchSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMatchId) {
        await updateMatch(editingMatchId, matchForm);
      } else {
        await createMatch(matchForm);
      }
      setMessage(editingMatchId ? 'Match updated successfully' : 'Match created successfully');
      setMatchForm(emptyMatch);
      setEditingMatchId(null);
      loadMatches();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save match');
    }
  };

  const handleDeleteMatch = async (id) => {
    if (!window.confirm('Delete this match?')) return;
    try {
      await deleteMatch(id);
      setMessage('Match deleted');
      loadMatches();
    } catch (error) {
      setMessage('Failed to delete match');
    }
  };

  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();
    Object.entries(ownerForm).forEach(([key, value]) => {
      if (key === 'image') {
        if (value) payload.append('image', value);
      } else {
        payload.append(key, value);
      }
    });
    try {
      if (editingOwnerId) {
        await updateOwner(editingOwnerId, payload);
      } else {
        await createOwner(payload);
      }
      setMessage('Owner saved successfully');
      setOwnerForm(emptyOwner);
      setEditingOwnerId(null);
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save owner');
    }
  };

  const handleSponsorSubmit = async (e) => {
    e.preventDefault();
    const payload = new FormData();
    Object.entries(sponsorForm).forEach(([key, value]) => {
      if (key === 'logo') {
        if (value) payload.append('logo', value);
      } else {
        payload.append(key, value);
      }
    });
    try {
      if (editingSponsorId) {
        await updateSponsor(editingSponsorId, payload);
      } else {
        await createSponsor(payload);
      }
      setMessage('Sponsor saved successfully');
      setSponsorForm(emptySponsor);
      setEditingSponsorId(null);
      loadData();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save sponsor');
    }
  };

  const deleteEntry = async (type, id) => {
    try {
      if (type === 'player') await deletePlayer(id);
      if (type === 'owner') await deleteOwner(id);
      if (type === 'sponsor') await deleteSponsor(id);
      setMessage(`${type} deleted successfully`);
      loadData();
    } catch (error) {
      setMessage('Delete failed');
    }
  };

  const formatMatchDate = (date) => {
    if (!date) return 'TBD';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Get unique team names from registered owners (filter out empty/auction pending)
  const registeredTeams = [...new Set(owners.map(o => o.team).filter(t => t && t !== 'Auction Pending'))];

  return (
    <div className="admin-dashboard">
      <aside className="sidebar">
        <h2>Admin Panel</h2>
        <button className={activeTab === 'players' ? 'active' : ''} onClick={() => setActiveTab('players')}>Players</button>
        <button className={activeTab === 'owners' ? 'active' : ''} onClick={() => setActiveTab('owners')}>Owners</button>
        <button className={activeTab === 'sponsors' ? 'active' : ''} onClick={() => setActiveTab('sponsors')}>Sponsors</button>
        <button className={activeTab === 'tournament' ? 'active' : ''} onClick={() => setActiveTab('tournament')}>Tournament</button>
        <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}>Matches</button>
        <button onClick={handleLogout}>Logout</button>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-cards">
          <div className="metric-card"><h3>{players.length}</h3><p>Players</p></div>
          <div className="metric-card"><h3>{owners.length}</h3><p>Owners</p></div>
          <div className="metric-card"><h3>{sponsors.length}</h3><p>Sponsors</p></div>
          <div className="metric-card"><h3>{matches.length}</h3><p>Matches</p></div>
          <div className="metric-card"><h3>{tournamentData ? 'Active' : 'Not Set'}</h3><p>Tournament</p></div>
        </div>

        {message && <div className="toast">{message}</div>}

        {activeTab === 'players' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handlePlayerSubmit}>
              <h3>{editingPlayerId ? 'Edit Player' : 'Add Player'}</h3>
              <input value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} placeholder="Player Name" required />
              <input value={playerForm.age} onChange={(e) => setPlayerForm({ ...playerForm, age: e.target.value })} placeholder="Age" required />
              <select value={playerForm.role} onChange={(e) => setPlayerForm({ ...playerForm, role: e.target.value })} required>
                <option value="Batsman">Batsman</option>
                <option value="Bowler">Bowler</option>
                <option value="All-rounder">All-rounder</option>
              </select>
              <input value={playerForm.team} onChange={(e) => setPlayerForm({ ...playerForm, team: e.target.value })} placeholder="Team (leave blank until auction)" />
              <input type="file" onChange={(e) => setPlayerForm({ ...playerForm, image: e.target.files[0] })} />
              <button type="submit">Save Player</button>
            </form>
            <div className="admin-list">
              {players.map((player) => (
                <div key={player._id} className="admin-item">
                  <div>
                    <strong>{player.name}</strong>
                    <p>{player.team}</p>
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => { setPlayerForm({ ...playerForm, ...player, image: '' }); setEditingPlayerId(player._id); }}>Edit</button>
                    <button onClick={() => deleteEntry('player', player._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'owners' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleOwnerSubmit}>
              <h3>{editingOwnerId ? 'Edit Owner' : 'Add Owner'}</h3>
              <input value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} placeholder="Owner Name" required />
              <input value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} placeholder="Phone" required />
              <input value={ownerForm.team} onChange={(e) => setOwnerForm({ ...ownerForm, team: e.target.value })} placeholder="Team (leave blank until auction)" />
              <input type="file" onChange={(e) => setOwnerForm({ ...ownerForm, image: e.target.files[0] })} />
              <button type="submit">Save Owner</button>
            </form>
            <div className="admin-list">
              {owners.map((owner) => (
                <div key={owner._id} className="admin-item">
                  <div>
                    <strong>{owner.name}</strong>
                    <p>{owner.team || 'Auction Pending'}</p>
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => { setOwnerForm({ ...ownerForm, ...owner, image: '' }); setEditingOwnerId(owner._id); }}>Edit</button>
                    <button onClick={() => deleteEntry('owner', owner._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'sponsors' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleSponsorSubmit}>
              <h3>{editingSponsorId ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
              <input value={sponsorForm.companyName} onChange={(e) => setSponsorForm({ ...sponsorForm, companyName: e.target.value })} placeholder="Sponsor Name" required />
              <input value={sponsorForm.sponsoredPrice} onChange={(e) => setSponsorForm({ ...sponsorForm, sponsoredPrice: e.target.value })} placeholder="Sponsored Price" />
              <input value={sponsorForm.phone} onChange={(e) => setSponsorForm({ ...sponsorForm, phone: e.target.value })} placeholder="Phone" required />
              <input type="file" onChange={(e) => setSponsorForm({ ...sponsorForm, logo: e.target.files[0] })} />
              <button type="submit">Save Sponsor</button>
            </form>
            <div className="admin-list">
              {sponsors.map((sponsor) => (
                <div key={sponsor._id} className="admin-item">
                  <div>
                    <strong>{sponsor.companyName}</strong>
                    <p>{sponsor.sponsoredPrice || 'No price'}</p>
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => { setSponsorForm({ ...sponsorForm, ...sponsor, logo: '' }); setEditingSponsorId(sponsor._id); }}>Edit</button>
                    <button onClick={() => deleteEntry('sponsor', sponsor._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'tournament' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleTournamentSubmit}>
              <h3>{tournamentData ? 'Update Tournament' : 'Set Tournament'}</h3>
              <p style={{ color: '#b8f3cf', fontSize: '0.85rem', margin: 0 }}>
                {tournamentData?.auctionDate && !tournamentData?.matchStartDate
                  ? '✅ Auction date set! Now add match details.'
                  : 'Step 1: Set auction date first. Step 2: Add match details later.'}
              </p>

              <label style={{ fontSize: '0.8rem', color: '#ffd96f', fontWeight: 600 }}>📅 Auction Date (Required)</label>
              <input type="date" value={tournamentForm.auctionDate} onChange={(e) => setTournamentForm({ ...tournamentForm, auctionDate: e.target.value })} required />

              {tournamentData?.auctionDate && (
                <>
                  <hr style={{ border: '1px solid rgba(255,255,255,0.1)', width: '100%' }} />
                  <p style={{ color: '#b8f3cf', fontSize: '0.85rem', margin: 0 }}>Step 2: Match details (add after auction date is announced)</p>
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>🏏 Match Start Date</label>
                  <input type="date" value={tournamentForm.matchStartDate} onChange={(e) => setTournamentForm({ ...tournamentForm, matchStartDate: e.target.value })} />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>🏏 Match End Date</label>
                  <input type="date" value={tournamentForm.matchEndDate} onChange={(e) => setTournamentForm({ ...tournamentForm, matchEndDate: e.target.value })} />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Lot A Name</label>
                  <input value={tournamentForm.lotA} onChange={(e) => setTournamentForm({ ...tournamentForm, lotA: e.target.value })} placeholder="Lot A" />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Lot A Day</label>
                  <input type="number" value={tournamentForm.lotADay} onChange={(e) => setTournamentForm({ ...tournamentForm, lotADay: e.target.value })} placeholder="1" min="1" />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Lot B Name</label>
                  <input value={tournamentForm.lotB} onChange={(e) => setTournamentForm({ ...tournamentForm, lotB: e.target.value })} placeholder="Lot B" />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Lot B Day</label>
                  <input type="number" value={tournamentForm.lotBDay} onChange={(e) => setTournamentForm({ ...tournamentForm, lotBDay: e.target.value })} placeholder="2" min="1" />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>🏟️ Venue</label>
                  <input value={tournamentForm.venue} onChange={(e) => setTournamentForm({ ...tournamentForm, venue: e.target.value })} placeholder="जुगाइदेवी स्टेडियम उरूल" />
                </>
              )}

              <button type="submit">
                {!tournamentData?.auctionDate ? 'Save Auction Date' : tournamentData?.matchStartDate ? 'Update Tournament' : 'Save Match Details'}
              </button>
              {tournamentData && (
                <button type="button" onClick={handleDeleteTournament} style={{ background: 'linear-gradient(135deg, #e74c3c, #c0392b)' }}>
                  Delete Tournament
                </button>
              )}
            </form>
            <div className="admin-list">
              {tournamentData ? (
                <div className="admin-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <strong style={{ color: '#2ecf73' }}>Current Tournament</strong>
                  <p>📅 Auction: {new Date(tournamentData.auctionDate).toLocaleDateString()}</p>
                  {tournamentData.matchStartDate && (
                    <>
                      <p>🏏 Matches: {new Date(tournamentData.matchStartDate).toLocaleDateString()} → {new Date(tournamentData.matchEndDate).toLocaleDateString()}</p>
                      <p>🏟️ Venue: {tournamentData.venue}</p>
                      <p>📊 {tournamentData.lotA} (Day {tournamentData.lotADay}) | {tournamentData.lotB} (Day {tournamentData.lotBDay})</p>
                    </>
                  )}
                  {!tournamentData.matchStartDate && (
                    <p style={{ color: '#ffd96f' }}>⏳ Match details not yet announced.</p>
                  )}
                </div>
              ) : (
                <div className="status-card">No tournament configured yet. Start by setting the auction date.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'matches' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleMatchSubmit}>
              <h3>{editingMatchId ? 'Edit Match' : 'Schedule a Match'}</h3>
              <p style={{ color: '#b8f3cf', fontSize: '0.85rem', margin: 0 }}>Set Team A vs Team B with date and time</p>
              {registeredTeams.length > 0 ? (
                <>
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Team A</label>
                  <select value={matchForm.teamA} onChange={(e) => setMatchForm({ ...matchForm, teamA: e.target.value })} required>
                    <option value="">-- Select Team A --</option>
                    {registeredTeams.map((team) => (
                      <option key={team} value={team} disabled={team === matchForm.teamB}>{team}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>VS</label>
                  <select value={matchForm.teamB} onChange={(e) => setMatchForm({ ...matchForm, teamB: e.target.value })} required>
                    <option value="">-- Select Team B --</option>
                    {registeredTeams.map((team) => (
                      <option key={team} value={team} disabled={team === matchForm.teamA}>{team}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <label style={{ fontSize: '0.8rem', color: '#ffd96f' }}>⚠️ No teams registered yet. Add owners with team names first.</label>
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Team A</label>
                  <input value={matchForm.teamA} onChange={(e) => setMatchForm({ ...matchForm, teamA: e.target.value })} placeholder="e.g. Gulmohar Lions" required />
                  <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>VS</label>
                  <input value={matchForm.teamB} onChange={(e) => setMatchForm({ ...matchForm, teamB: e.target.value })} placeholder="e.g. Suryanagar Strikers" required />
                </>
              )}
              <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Match Date</label>
              <input type="date" value={matchForm.matchDate} onChange={(e) => setMatchForm({ ...matchForm, matchDate: e.target.value })} required />
              <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Match Time</label>
              <input type="time" value={matchForm.matchTime} onChange={(e) => setMatchForm({ ...matchForm, matchTime: e.target.value })} />
              <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Lot</label>
              <select value={matchForm.lot} onChange={(e) => setMatchForm({ ...matchForm, lot: e.target.value })}>
                <option value="Lot A">Lot A</option>
                <option value="Lot B">Lot B</option>
              </select>
              <label style={{ fontSize: '0.8rem', color: '#b8f3cf' }}>Venue</label>
              <input value={matchForm.venue} onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })} placeholder="जुगाइदेवी स्टेडियम उरूल" />
              <button type="submit">{editingMatchId ? 'Update Match' : 'Create Match'}</button>
            </form>
            <div className="admin-list">
              {matches.length === 0 ? (
                <div className="status-card">No matches scheduled yet.</div>
              ) : (
                matches.map((match) => (
                  <div key={match._id} className="admin-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <strong style={{ color: '#ffd96f' }}>{match.teamA} 🏏 {match.teamB}</strong>
                    <p>📅 {formatMatchDate(match.matchDate)} | ⏰ {match.matchTime} | 📊 {match.lot}</p>
                    <p>🏟️ {match.venue}</p>
                    <div className="admin-actions">
                      <button onClick={() => {
                        setMatchForm({
                          teamA: match.teamA,
                          teamB: match.teamB,
                          matchDate: toDateInputValue(match.matchDate),
                          matchTime: match.matchTime,
                          lot: match.lot,
                          venue: match.venue
                        });
                        setEditingMatchId(match._id);
                      }}>Edit</button>
                      <button onClick={() => handleDeleteMatch(match._id)} style={{ background: 'linear-gradient(135deg, #e74c3c, #c0392b)' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;