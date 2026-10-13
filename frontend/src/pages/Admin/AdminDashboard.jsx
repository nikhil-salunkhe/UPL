import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { advertisementImageUrl } from '../../services/api';
import { approvePlayer, createPlayer, deletePlayer, getAllPlayers, updatePlayer } from '../../services/playerService';
import { createOwner, deleteOwner, getOwners, reorderOwners, updateOwner } from '../../services/ownerService';
import { createSponsor, deleteSponsor, getSponsors, updateSponsor } from '../../services/sponsorService';
import {
  createAdvertisement,
  deleteAdvertisement,
  getAllAdvertisements,
  updateAdvertisement
} from '../../services/advertisementService';
import { createRule, deleteRule, getAllRules, updateRule } from '../../services/ruleService';
import { getTournament, saveTournament } from '../../services/tournamentService';
import { getMatches, createMatch, updateMatch, deleteMatch } from '../../services/matchService';
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar';
import './Admin.css';

const emptyPlayer = { name: '', role: 'Batsman', team: '', image: '' };
const emptyOwner = { name: '', phone: '', team: '', captain: '', viceCaptain: '', image: '' };
const emptySponsor = { companyName: '', sponsoredPrice: '', phone: '', logo: '' };
const emptyAd = { team: '', title: '', description: '', link: '', banner: '', isActive: true, displayOrder: 0 };
const emptyRule = { title: '', description: '', category: 'General', isActive: true, displayOrder: 0 };
const emptyTournament = { auctionDate: '', matchStartDate: '', matchEndDate: '', lotA: 'Lot A', lotB: 'Lot B', lotADay: 1, lotBDay: 2, venue: 'जुगाइदेवी स्टेडियम उरूल' };
const emptyMatch = { teamA: '', teamB: '', matchDate: '', matchTime: '10:00 AM', lot: 'Lot A', venue: 'जुगाइदेवी स्टेडियम उरूल' };
// Captain / vice-captain are player NAMES — guard against corrupted records
// where an image data URL ended up in these fields (renders as base64 text).
const cleanLeaderName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  if (/^(data|blob|https?):/i.test(trimmed) || trimmed.length > 80) return '';
  return trimmed;
};

const sortOwnersByOrder = (list) => [...(list || [])].sort(
  (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
);

// Same rule as the backend: anything that is not 'pending' counts as approved
// (legacy records stored before the status field existed are approved).
const playerMatchesStatus = (player, status) => {
  if (status === 'all') return true;
  if (status === 'pending') return player.status === 'pending';
  return player.status !== 'pending';
};

const countPlayersByStatus = (list) => {
  const pending = list.filter((player) => player.status === 'pending').length;
  return { all: list.length, pending, approved: list.length - pending };
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('players');
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [advertisements, setAdvertisements] = useState([]);
  const [rules, setRules] = useState([]);
  const [matches, setMatches] = useState([]);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [ownerForm, setOwnerForm] = useState(emptyOwner);
  const [sponsorForm, setSponsorForm] = useState(emptySponsor);
  const [adForm, setAdForm] = useState(emptyAd);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingOwnerId, setEditingOwnerId] = useState(null);
  const [editingSponsorId, setEditingSponsorId] = useState(null);
  const [editingAdId, setEditingAdId] = useState(null);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [tournamentForm, setTournamentForm] = useState(emptyTournament);
  const [tournamentData, setTournamentData] = useState(null);
  const [matchForm, setMatchForm] = useState(emptyMatch);
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [message, setMessage] = useState('');
  const [playerPage, setPlayerPage] = useState(1);
  const [playerStatus, setPlayerStatus] = useState('all'); // 'all' | 'pending' | 'approved'
  const [playerPagination, setPlayerPagination] = useState(null);
  const [playerCounts, setPlayerCounts] = useState(null);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState('');
  const [roster, setRoster] = useState([]); // full lightweight player list for captain/VC pickers
  const didInitRef = useRef(false);

  // Player search box state (client-side filter over the current page).
  const [playerSearch, setPlayerSearch] = useState('');

  const PLAYERS_PAGE_SIZE = 25;

  // Admin player list: paginated server-side, photos excluded from the payload
  // (each photo is served on demand by GET /players/:id/image). Errors land in
  // state so the panel can retry without blanking the rest of the dashboard.
  const fetchPlayersPage = async (page = playerPage, status = playerStatus, isClamp = false) => {
    setPlayersLoading(true);
    setPlayersError('');
    try {
      const body = await getAllPlayers({ page, limit: PLAYERS_PAGE_SIZE, status });
      const rawList = Array.isArray(body.data) ? body.data : [];
      const isLegacy = !body.pagination; // older backend: one bare array

      let list = rawList;
      let counts = body.counts || null;

      if (isLegacy) {
        counts = countPlayersByStatus(rawList);
        if (status !== 'all') {
          list = rawList.filter((player) => playerMatchesStatus(player, status));
        }
      }

      // After approving/rejecting the last item of a page the page can come
      // back empty — snap back to the last page that still has players.
      if (!isClamp && page > 1 && list.length === 0 && !isLegacy && body.pagination.total > 0) {
        const lastPage = Math.max(1, Math.ceil(body.pagination.total / PLAYERS_PAGE_SIZE));
        setPlayerPage(lastPage);
        return fetchPlayersPage(lastPage, status, true);
      }

      setPlayers(list);
      setPlayerPagination(body.pagination || null);
      setPlayerCounts(counts);
    } catch (error) {
      setPlayers([]);
      setPlayerPagination(null);
      setPlayersError(
        error.response?.data?.message || 'Could not load players. Check the connection and try again.'
      );
    } finally {
      setPlayersLoading(false);
    }
  };

  // Promise.allSettled: owners, sponsors and the captain/VC roster load
  // independently — one slow or failed request can no longer discard the
  // others (the old Promise.all dropped everything when players timed out).
  const loadData = async () => {
    const [, ownersResult, sponsorsResult, rosterResult, adsResult, rulesResult] = await Promise.allSettled([
      fetchPlayersPage(playerPage, playerStatus),
      getOwners(),
      getSponsors(),
      getAllPlayers({ page: 1, limit: 1000 }), // full list, no photos (~KBs)
      getAllAdvertisements(),
      getAllRules()
    ]);

    if (ownersResult.status === 'fulfilled') {
      setOwners(sortOwnersByOrder(ownersResult.value));
    }
    if (sponsorsResult.status === 'fulfilled') {
      setSponsors(sponsorsResult.value);
    }
    if (rosterResult.status === 'fulfilled') {
      const body = rosterResult.value;
      setRoster(Array.isArray(body) ? body : body.data || []);
    }
    if (adsResult.status === 'fulfilled') {
      setAdvertisements(adsResult.value);
    }
    if (rulesResult.status === 'fulfilled') {
      setRules(rulesResult.value);
    }

    const failed = [];
    if (ownersResult.status === 'rejected') failed.push('owners');
    if (sponsorsResult.status === 'rejected') failed.push('sponsors');
    if (rosterResult.status === 'rejected') failed.push('player names');
    if (adsResult.status === 'rejected') failed.push('advertisements');
    if (rulesResult.status === 'rejected') failed.push('rules');
    // Player-list failures are surfaced inline in the players panel with Retry.
    if (failed.length) {
      setMessage(`Could not load: ${failed.join(', ')}. The rest of the dashboard loaded fine.`);
    }
  };

  // Targeted refreshes: after a save/delete only the affected collection is
  // refetched (loadData() reloads all six and is reserved for the initial
  // mount) — this keeps every admin action at 1-2 requests instead of 6.
  const refreshRoster = async () => {
    try {
      const body = await getAllPlayers({ page: 1, limit: 1000 });
      setRoster(Array.isArray(body) ? body : body.data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const refreshPlayers = () => fetchPlayersPage(playerPage, playerStatus);

  const refreshOwners = async () => {
    try {
      setOwners(sortOwnersByOrder(await getOwners()));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not refresh owners');
    }
  };

  const refreshSponsors = async () => {
    try {
      setSponsors(await getSponsors());
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not refresh sponsors');
    }
  };

  const refreshAds = async () => {
    try {
      setAdvertisements(await getAllAdvertisements());
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not refresh advertisements');
    }
  };

  const refreshRules = async () => {
    try {
      setRules(await getAllRules());
    } catch (error) {
      setMessage(error.response?.data?.message || 'Could not refresh rules');
    }
  };

  // Toast messages are informational — clear them so stale status doesn't
  // linger at the top of the dashboard after the action succeeded.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => setMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  const changePlayerPage = (page) => {
    setPlayerPage(page);
    fetchPlayersPage(page, playerStatus);
  };

  const changePlayerStatus = (status) => {
    setPlayerStatus(status);
    setPlayerPage(1);
    fetchPlayersPage(1, status);
  };

  const retryPlayers = () => fetchPlayersPage(playerPage, playerStatus);

  // Row numbers continue across pages of the current filter (page 2 starts at
  // #26). With the legacy single-array backend everything is on page 1.
  const playerNumberOffset = playerPagination ? (playerPage - 1) * PLAYERS_PAGE_SIZE : 0;

  // Client-side search over the players on the current page (photos are served
  // on demand, so this stays cheap). Narrowing is case-insensitive across
  // name / role / team; the # numbering still follows the server page.
  const filteredPlayers = players.filter((player) => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return true;
    return [player.name, player.role, player.team].some((field) =>
      String(field).toLowerCase().includes(q)
    );
  });

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

    // Guard against double-invoked effects (React StrictMode in dev) so the
    // dashboard never fires duplicate requests on mount.
    if (didInitRef.current) return;
    didInitRef.current = true;

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
      } else if (value !== undefined && value !== null) {
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
      // Player name/team feed the captain & vice-captain pickers too.
      refreshPlayers();
      refreshRoster();
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
      setMessage(error.response?.data?.message || 'Failed to delete tournament');
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
      setMessage(error.response?.data?.message || 'Failed to delete match');
    }
  };

  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    const captain = ownerForm.captain.trim();
    const viceCaptain = ownerForm.viceCaptain.trim();
    if (captain && viceCaptain && captain.toLowerCase() === viceCaptain.toLowerCase()) {
      setMessage('Captain and Vice Captain must be different');
      return;
    }
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
      refreshOwners();
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
      refreshSponsors();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save sponsor');
    }
  };

  const handleAdSubmit = async (e) => {
    e.preventDefault();
    if (!adForm.team.trim() || !adForm.title.trim()) {
      setMessage('Team and ad title are required');
      return;
    }
    const payload = new FormData();
    payload.append('team', adForm.team.trim());
    payload.append('title', adForm.title.trim());
    payload.append('description', adForm.description || '');
    payload.append('link', adForm.link || '');
    payload.append('isActive', adForm.isActive ? 'true' : 'false');
    payload.append('displayOrder', String(adForm.displayOrder || 0));
    // Send the banner whether it is a File or the base64 data URL produced by
    // handleAdBannerChange. It used to be skipped whenever it was a string, so
    // ads were saved without any image (broken banner on Home).
    if (adForm.banner) {
      payload.append('banner', adForm.banner);
    }
    try {
      if (editingAdId) {
        await updateAdvertisement(editingAdId, payload);
      } else {
        await createAdvertisement(payload);
      }
      setMessage(editingAdId ? 'Advertisement updated successfully' : 'Advertisement created successfully');
      setAdForm(emptyAd);
      setEditingAdId(null);
      refreshAds();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save advertisement');
    }
  };

  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    if (!ruleForm.title.trim() || !ruleForm.description.trim()) {
      setMessage('Rule title and description are required');
      return;
    }
    try {
      if (editingRuleId) {
        await updateRule(editingRuleId, ruleForm);
      } else {
        await createRule(ruleForm);
      }
      setMessage(editingRuleId ? 'Rule updated successfully' : 'Rule created successfully');
      setRuleForm(emptyRule);
      setEditingRuleId(null);
      refreshRules();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to save rule');
    }
  };

  const handleAdBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Server accepts up to 12MB as a base64 text field (~8.7MB raw image);
    // anything bigger would be rejected with a cryptic 400, so fail fast here
    // with a readable message.
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Banner image must be smaller than 8MB');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAdForm((prev) => ({ ...prev, banner: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleAdEdit = (ad) => {
    setAdForm({
      team: ad.team || '',
      title: ad.title || '',
      description: ad.description || '',
      link: ad.link || '',
      banner: ad.banner || '',
      isActive: ad.isActive !== false,
      displayOrder: ad.displayOrder || 0
    });
    setEditingAdId(ad._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAdDelete = async (id) => {
    if (!window.confirm('Delete this advertisement?')) return;
    try {
      await deleteAdvertisement(id);
      setMessage('Advertisement deleted successfully');
      if (editingAdId === id) {
        setEditingAdId(null);
        setAdForm(emptyAd);
      }
      refreshAds();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to delete advertisement');
    }
  };

  const handleRuleEdit = (rule) => {
    setRuleForm({
      title: rule.title || '',
      description: rule.description || '',
      category: rule.category || 'General',
      isActive: rule.isActive !== false,
      displayOrder: rule.displayOrder || 0
    });
    setEditingRuleId(rule._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRuleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await deleteRule(id);
      setMessage('Rule deleted successfully');
      if (editingRuleId === id) {
        setEditingRuleId(null);
        setRuleForm(emptyRule);
      }
      refreshRules();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to delete rule');
    }
  };


  const deleteEntry = async (type, id) => {
    try {
      if (type === 'player') await deletePlayer(id);
      if (type === 'owner') await deleteOwner(id);
      if (type === 'sponsor') await deleteSponsor(id);
      if (type === 'advertisement') await deleteAdvertisement(id);
      if (type === 'rule') await deleteRule(id);
      setMessage(`${type} deleted successfully`);
      if (type === 'player') {
        refreshPlayers();
        refreshRoster();
      } else if (type === 'owner') {
        refreshOwners();
      } else if (type === 'sponsor') {
        refreshSponsors();
      } else if (type === 'advertisement') {
        refreshAds();
      } else if (type === 'rule') {
        refreshRules();
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Delete failed');
    }
  };

  const moveOwner = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= owners.length) return;
    const reordered = [...owners];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    // Stamp local displayOrder immediately so #numbers follow the new sequence
    // even if the backend save fails or the old backend is still live.
    const withOrder = reordered.map((o, i) => ({ ...o, displayOrder: i + 1 }));
    setOwners(withOrder);
    try {
      const updated = await reorderOwners(withOrder.map((o) => o._id));
      if (Array.isArray(updated) && updated.length) {
        setOwners(sortOwnersByOrder(updated));
      }
      setMessage(`"${moved.team || moved.name}" moved to position ${newIndex + 1} ✅`);
    } catch (error) {
      const status = error.response?.status;
      const serverMsg = error.response?.data?.message;
      if (status === 404) {
        // Old backend without PUT /owners/reorder: order stays locally and
        // Home still sorts by displayOrder once backend is redeployed.
        setMessage(`"${moved.team || moved.name}" moved to #${newIndex + 1} locally — redeploy backend to save it permanently ⚠️`);
      } else {
        setMessage(serverMsg || 'Reorder failed — please retry');
        refreshOwners();
      }
    }
  };

  const handleApprovePlayer = async (id) => {
    try {
      await approvePlayer(id);
      setMessage('Player approved ✅');
      // Status changed; the roster (captain pickers) lists everyone.
      refreshPlayers();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Approval failed');
    }
  };

  const handleRejectPlayer = async (id, name) => {
    if (!window.confirm(`Reject & delete registration of "${name}"?`)) return;
    try {
      await deletePlayer(id);
      setMessage('Registration rejected & removed');
      refreshPlayers();
      refreshRoster();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Reject failed');
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

  const selectedCaptain = roster.find((player) => player.name === cleanLeaderName(ownerForm.captain));
  const selectedViceCaptain = roster.find((player) => player.name === cleanLeaderName(ownerForm.viceCaptain));

  return (
    <div className="admin-dashboard">
      <aside className="sidebar">
        <h2>Admin Panel</h2>
        <button className={activeTab === 'players' ? 'active' : ''} onClick={() => setActiveTab('players')}>Players</button>
        <button className={activeTab === 'owners' ? 'active' : ''} onClick={() => setActiveTab('owners')}>Owners</button>
        <button className={activeTab === 'sponsors' ? 'active' : ''} onClick={() => setActiveTab('sponsors')}>Sponsors</button>
        <button className={activeTab === 'ads' ? 'active' : ''} onClick={() => setActiveTab('ads')}>Team Ads</button>
        <button className={activeTab === 'rules' ? 'active' : ''} onClick={() => setActiveTab('rules')}>Rules</button>
        <button className={activeTab === 'tournament' ? 'active' : ''} onClick={() => setActiveTab('tournament')}>Tournament</button>
        <button className={activeTab === 'matches' ? 'active' : ''} onClick={() => setActiveTab('matches')}>Matches</button>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-cards">
          <div className="metric-card"><h3>{playerCounts ? playerCounts.all : players.length}</h3><p>Players</p></div>
          <div className="metric-card"><h3>{owners.length}</h3><p>Owners</p></div>
          <div className="metric-card"><h3>{sponsors.length}</h3><p>Sponsors</p></div>
          <div className="metric-card"><h3>{advertisements.length}</h3><p>Team Ads</p></div>
          <div className="metric-card"><h3>{rules.length}</h3><p>Rules</p></div>
          <div className="metric-card"><h3>{matches.length}</h3><p>Matches</p></div>
          <div className="metric-card"><h3>{tournamentData ? 'Active' : 'Not Set'}</h3><p>Tournament</p></div>
        </div>

        {message && <div className="toast">{message}</div>}

        {activeTab === 'players' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handlePlayerSubmit}>
              <h3>{editingPlayerId ? 'Edit Player' : 'Add Player'}</h3>
              <input value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} placeholder="Player Name" required />
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
              <div className="list-search">
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search players…"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                />
              </div>
              <div className="list-filters">
                <button type="button" className={`filter-chip${playerStatus === 'all' ? ' active' : ''}`} onClick={() => changePlayerStatus('all')}>
                  All{playerCounts ? ` (${playerCounts.all})` : ''}
                </button>
                <button type="button" className={`filter-chip${playerStatus === 'pending' ? ' active' : ''}`} onClick={() => changePlayerStatus('pending')}>
                  ⏳ Pending{playerCounts ? ` (${playerCounts.pending})` : ''}
                </button>
                <button type="button" className={`filter-chip${playerStatus === 'approved' ? ' active' : ''}`} onClick={() => changePlayerStatus('approved')}>
                  ✅ Approved{playerCounts ? ` (${playerCounts.approved})` : ''}
                </button>
              </div>

              <h4 className="list-heading">
                Players {playerPagination ? `(${playerPagination.total})` : `(${playerCounts ? playerCounts.all : players.length})`}
              </h4>

              {playersLoading && <div className="status-card">Loading players…</div>}

              {!playersLoading && playersError && (
                <div className="status-card">
                  ⚠️ {playersError}
                  <button type="button" className="retry-btn" onClick={retryPlayers}>Retry</button>
                </div>
              )}

              {!playersLoading && !playersError && players.length === 0 && (
                <div className="status-card">
                  {playerStatus === 'pending' ? 'No pending registrations 🎉' : 'No players found for this filter.'}
                </div>
              )}

              {!playersLoading && !playersError && filteredPlayers.map((player, index) => (
                <div key={player._id} className={`admin-item${player.status === 'pending' ? ' pending-item' : ''}`}>
                  <PlayerAvatar player={player} name={player.name} size={34} />
                  <div>
                    <strong><span style={{ color: '#2ecf73' }}>#{playerNumberOffset + index + 1}</span> {player.name}</strong>
                    <p>{player.role}{player.team ? ` • ${player.team}` : ''}</p>
                  </div>
                  <div className="admin-actions">
                    {player.status === 'pending' ? (
                      <>
                        <button className="approve-btn" onClick={() => handleApprovePlayer(player._id)}>Approve ✅</button>
                        <button className="reject-btn" onClick={() => handleRejectPlayer(player._id, player.name)}>Reject ❌</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setPlayerForm({ ...emptyPlayer, ...player, image: '' }); setEditingPlayerId(player._id); }}>Edit</button>
                        <button onClick={() => deleteEntry('player', player._id)}>Delete</button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {!playersError && playerPagination && playerPagination.totalPages > 1 && (
                <div className="pagination-controls">
                  <button type="button" onClick={() => changePlayerPage(playerPage - 1)} disabled={playerPage <= 1}>← Prev</button>
                  <span className="page-info">Page {playerPage} of {playerPagination.totalPages}</span>
                  <button type="button" onClick={() => changePlayerPage(playerPage + 1)} disabled={playerPage >= playerPagination.totalPages}>Next →</button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'owners' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleOwnerSubmit}>
              <h3>{editingOwnerId ? 'Edit Owner' : 'Add Owner'}</h3>
              <input value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} placeholder="Owner Name" required />
              <input value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} placeholder="Phone" required />
              <input value={ownerForm.team} onChange={(e) => setOwnerForm({ ...ownerForm, team: e.target.value })} placeholder="Team Name" required />
              <label style={{ fontSize: '0.8rem', color: '#ffd96f' }}>Captain (select from added players)</label>
              <select value={ownerForm.captain} onChange={(e) => setOwnerForm({ ...ownerForm, captain: e.target.value })}>
                <option value="">-- Select Captain --</option>
                {roster.map((player) => (
                  <option key={player._id} value={player.name} disabled={player.name === ownerForm.viceCaptain}>
                    {player.name}{player.team ? ` — ${player.team}` : ''}
                  </option>
                ))}
                {cleanLeaderName(ownerForm.captain) && !roster.some((player) => player.name === cleanLeaderName(ownerForm.captain)) && (
                  <option value={cleanLeaderName(ownerForm.captain)}>{cleanLeaderName(ownerForm.captain)}</option>
                )}
              </select>
              <label style={{ fontSize: '0.8rem', color: '#ffd96f' }}>Vice Captain (select from added players)</label>
              <select value={ownerForm.viceCaptain} onChange={(e) => setOwnerForm({ ...ownerForm, viceCaptain: e.target.value })}>
                <option value="">-- Select Vice Captain --</option>
                {roster.map((player) => (
                  <option key={player._id} value={player.name} disabled={player.name === ownerForm.captain}>
                    {player.name}{player.team ? ` — ${player.team}` : ''}
                  </option>
                ))}
                {cleanLeaderName(ownerForm.viceCaptain) && !roster.some((player) => player.name === cleanLeaderName(ownerForm.viceCaptain)) && (
                  <option value={cleanLeaderName(ownerForm.viceCaptain)}>{cleanLeaderName(ownerForm.viceCaptain)}</option>
                )}
              </select>
              {roster.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#ffd96f' }}>No players added yet — add players first to select captain &amp; vice captain.</p>
              )}
              {(selectedCaptain || selectedViceCaptain) && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {selectedCaptain && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2rem', padding: '0.35rem 0.85rem 0.35rem 0.35rem' }}>
                      <PlayerAvatar player={selectedCaptain} size={36} />
                      <span style={{ fontSize: '0.85rem', color: '#eaf4ff' }}><strong style={{ color: '#ffd96f' }}>C:</strong> {selectedCaptain.name}</span>
                    </div>
                  )}
                  {selectedViceCaptain && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '2rem', padding: '0.35rem 0.85rem 0.35rem 0.35rem' }}>
                      <PlayerAvatar player={selectedViceCaptain} size={36} />
                      <span style={{ fontSize: '0.85rem', color: '#eaf4ff' }}><strong style={{ color: '#ffd96f' }}>VC:</strong> {selectedViceCaptain.name}</span>
                    </div>
                  )}
                </div>
              )}
              <input type="file" onChange={(e) => setOwnerForm({ ...ownerForm, image: e.target.files[0] })} />
              <button type="submit">Save Owner</button>
            </form>
            <div className="admin-list">
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#b8f3cf' }}>🔢 Home screen shows teams in this order — use ↑ ↓ to set 1st, 2nd, 3rd…</p>
              {owners.map((owner, index) => (
                <div key={owner._id} className="admin-item">
                  <div>
                    <strong><span style={{ color: '#2ecf73' }}>#{index + 1}</span> {owner.name}</strong>
                    <p>{owner.team || 'Auction Pending'}</p>
                    {(() => {
                      const c = cleanLeaderName(owner.captain);
                      const vc = cleanLeaderName(owner.viceCaptain);
                      return (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span className="player-cell">
                        {c && <PlayerAvatar player={roster.find((player) => player.name === c)} name={c} size={24} />}
                        C: {c || 'TBD'}
                      </span>
                      <span className="player-cell">
                        {vc && <PlayerAvatar player={roster.find((player) => player.name === vc)} name={vc} size={24} />}
                        VC: {vc || 'TBD'}
                      </span>
                    </p>
                      );
                    })()}
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      onClick={() => moveOwner(index, -1)}
                      disabled={index === 0}
                      title="Move up (show earlier on Home)"
                      style={{ minWidth: '44px', fontSize: '1.05rem', opacity: index === 0 ? 0.4 : 1 }}
                    >↑ Up</button>
                    <button
                      type="button"
                      onClick={() => moveOwner(index, 1)}
                      disabled={index === owners.length - 1}
                      title="Move down (show later on Home)"
                      style={{ minWidth: '44px', fontSize: '1.05rem', opacity: index === owners.length - 1 ? 0.4 : 1 }}
                    >↓ Down</button>
                    <button onClick={() => { setOwnerForm({ ...emptyOwner, ...owner, captain: cleanLeaderName(owner.captain), viceCaptain: cleanLeaderName(owner.viceCaptain), image: '' }); setEditingOwnerId(owner._id); }}>Edit</button>
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

        {activeTab === 'ads' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleAdSubmit}>
              <h3>{editingAdId ? 'Edit Advertisement' : 'Add Advertisement'}</h3>
              <input
                value={adForm.team}
                onChange={(e) => setAdForm({ ...adForm, team: e.target.value })}
                placeholder="Team"
                required
              />
              <input
                value={adForm.title}
                onChange={(e) => setAdForm({ ...adForm, title: e.target.value })}
                placeholder="Ad Title"
                required
              />
              <input
                value={adForm.description}
                onChange={(e) => setAdForm({ ...adForm, description: e.target.value })}
                placeholder="Description"
              />
              <input
                value={adForm.link}
                onChange={(e) => setAdForm({ ...adForm, link: e.target.value })}
                placeholder="Link (URL)"
              />
              <input
                type="file"
                onChange={handleAdBannerChange}
                accept="image/*"
                placeholder="Upload banner"
              />
              <div className="admin-row">
                <label className="toggle-row">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={adForm.isActive}
                    onChange={(e) => setAdForm({ ...adForm, isActive: e.target.checked })}
                  />
                </label>
                <label className="toggle-row">
                  <span>Display Order</span>
                  <input
                    type="number"
                    value={adForm.displayOrder}
                    onChange={(e) => setAdForm({ ...adForm, displayOrder: Number(e.target.value) })}
                    min={0}
                  />
                </label>
              </div>
              <button type="submit">{editingAdId ? 'Update Advertisement' : 'Save Advertisement'}</button>
            </form>
            <div className="admin-list">
              {advertisements.map((ad) => (
                <div key={ad._id} className="admin-item">
                  <div className="admin-item-prev">
                    {ad._id ? (
                      <img
                        src={advertisementImageUrl(ad._id)}
                        alt={ad.title}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="no-image">No banner</div>
                    )}
                  </div>
                  <div>
                    <strong>{ad.team}</strong>
                    <p>{ad.title}</p>
                    <p className="muted">{ad.link}</p>
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => handleAdEdit(ad)}>Edit</button>
                    <button onClick={() => handleAdDelete(ad._id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'rules' && (
          <section className="admin-section">
            <form className="admin-form" onSubmit={handleRuleSubmit}>
              <h3>{editingRuleId ? 'Edit Rule' : 'Add Rule'}</h3>
              <input
                value={ruleForm.title}
                onChange={(e) => setRuleForm({ ...ruleForm, title: e.target.value })}
                placeholder="Rule Title"
                required
              />
              <textarea
                value={ruleForm.description}
                onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                placeholder="Description"
                rows={4}
              />
              <select
                value={ruleForm.category}
                onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
              >
                <option value="General">General</option>
                <option value="Safety">Safety</option>
                <option value="Policies">Policies</option>
                <option value="Other">Other</option>
              </select>
              <div className="admin-row">
                <label className="toggle-row">
                  <span>Active</span>
                  <input
                    type="checkbox"
                    checked={ruleForm.isActive}
                    onChange={(e) => setRuleForm({ ...ruleForm, isActive: e.target.checked })}
                  />
                </label>
                <label className="toggle-row">
                  <span>Display Order</span>
                  <input
                    type="number"
                    value={ruleForm.displayOrder}
                    onChange={(e) => setRuleForm({ ...ruleForm, displayOrder: Number(e.target.value) })}
                    min={0}
                  />
                </label>
              </div>
              <button type="submit">{editingRuleId ? 'Update Rule' : 'Save Rule'}</button>
            </form>
            <div className="admin-list">
              {rules.map((rule) => (
                <div key={rule._id} className="admin-item">
                  <div className="admin-item-prev">
                    <span className="rule-category">{rule.category}</span>
                    <strong>{rule.title}</strong>
                    <p>{rule.description}</p>
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => handleRuleEdit(rule)}>Edit</button>
                    <button onClick={() => handleRuleDelete(rule._id)}>Delete</button>
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