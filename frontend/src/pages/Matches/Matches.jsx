import { useEffect, useState } from 'react';
import { getMatches } from '../../services/matchService';
import { getTournament } from '../../services/tournamentService';
import { getOwners } from '../../services/ownerService';
import { apiBaseUrl } from '../../services/api';
import './Matches.css';

const Matches = () => {
  const [matches, setMatches] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [teamLogos, setTeamLogos] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [matchData, tournamentData, ownersData] = await Promise.all([getMatches(), getTournament(), getOwners()]);
        setMatches(matchData);
        setTournament(tournamentData);

        // Build team logo map: team name → image URL
        const logoMap = {};
        ownersData.forEach(owner => {
          if (owner.team && owner.team !== 'Auction Pending') {
            let imageUrl = '';
            if (owner.image) {
              if (owner.image.startsWith('http')) {
                imageUrl = owner.image;
              } else {
                imageUrl = `${apiBaseUrl}${owner.image.startsWith('/') ? owner.image : `/${owner.image}`}`;
              }
            }
            logoMap[owner.team] = imageUrl;
          }
        });
        setTeamLogos(logoMap);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const formatDate = (date) => {
    if (!date) return 'TBD';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatTime = (time) => {
    if (!time) return '';
    // If time is in HH:MM format, keep as is; otherwise return as is
    return time;
  };

  // Separate matches by lot
  const lotAMatches = matches.filter(m => m.lot === 'Lot A');
  const lotBMatches = matches.filter(m => m.lot === 'Lot B');
  const unassignedMatches = matches.filter(m => m.lot !== 'Lot A' && m.lot !== 'Lot B');

  // Group matches within each lot by date
  const groupByDate = (matchList) => {
    const grouped = {};
    matchList.forEach(m => {
      const key = formatDate(m.matchDate);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });
    return grouped;
  };

  const lotAGrouped = groupByDate(lotAMatches);
  const lotBGrouped = groupByDate(lotBMatches);
  const unassignedGrouped = groupByDate(unassignedMatches);

  const renderMatchCard = (match) => (
    <div key={match._id} className="match-card">
      <div className="match-teams">
        <div className="team team-a">
          {teamLogos[match.teamA] ? (
            <img src={teamLogos[match.teamA]} alt={match.teamA} className="team-logo" />
          ) : (
            <div className="team-logo-placeholder">🏏</div>
          )}
          <span className="team-name">{match.teamA}</span>
        </div>
        <div className="match-vs">
          <span className="vs-badge">VS</span>
          <span className="match-time">{formatTime(match.matchTime)}</span>
        </div>
        <div className="team team-b">
          {teamLogos[match.teamB] ? (
            <img src={teamLogos[match.teamB]} alt={match.teamB} className="team-logo" />
          ) : (
            <div className="team-logo-placeholder">🏏</div>
          )}
          <span className="team-name">{match.teamB}</span>
        </div>
      </div>
      <div className="match-meta">
        <span>🏟️ {match.venue}</span>
        <span className={`status-badge ${match.status?.toLowerCase()}`}>{match.status || 'Scheduled'}</span>
      </div>
    </div>
  );

  const renderDayGroup = (grouped, lotLabel) => (
    Object.entries(grouped).map(([date, dayMatches]) => (
      <div key={date} className="match-day-group">
        <div className="match-day-header">
          <span className="match-date-badge">{date}</span>
          <span className="match-count">{dayMatches.length} match{dayMatches.length > 1 ? 'es' : ''}</span>
        </div>
        <div className="match-cards">
          {dayMatches.map(renderMatchCard)}
        </div>
      </div>
    ))
  );

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">🏏 Match Schedule</p>
          <h1>Matches</h1>
        </div>
      </section>

      {tournament && (
        <section className="tournament-info-bar">
          <span>📅 Auction: {formatDate(tournament.auctionDate)}</span>
          {tournament.matchStartDate && (
            <span>🏏 {formatDate(tournament.matchStartDate)} → {formatDate(tournament.matchEndDate)}</span>
          )}
          <span>🏟️ {tournament.venue}</span>
        </section>
      )}

      {loading ? (
        <div className="status-card">Loading matches...</div>
      ) : matches.length === 0 ? (
        <div className="status-card">No matches scheduled yet. Check back after the auction.</div>
      ) : (
        <div className="lots-container">
          {/* Lot A Column */}
          <div className="lot-column lot-a-column">
            <div className="lot-column-header">
              <h2>Lot A</h2>
              <span className="lot-match-count">{lotAMatches.length} matches</span>
            </div>
            {lotAMatches.length === 0 ? (
              <div className="status-card">No Lot A matches scheduled.</div>
            ) : (
              renderDayGroup(lotAGrouped, 'Lot A')
            )}
          </div>

          {/* Lot B Column */}
          <div className="lot-column lot-b-column">
            <div className="lot-column-header">
              <h2>Lot B</h2>
              <span className="lot-match-count">{lotBMatches.length} matches</span>
            </div>
            {lotBMatches.length === 0 ? (
              <div className="status-card">No Lot B matches scheduled.</div>
            ) : (
              renderDayGroup(lotBGrouped, 'Lot B')
            )}
          </div>

          {/* Unassigned matches (if any) - full width */}
          {unassignedMatches.length > 0 && (
            <div className="lot-column full-width">
              <div className="lot-column-header">
                <h2>Other Matches</h2>
                <span className="lot-match-count">{unassignedMatches.length} matches</span>
              </div>
              {renderDayGroup(unassignedGrouped, 'Other')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Matches;