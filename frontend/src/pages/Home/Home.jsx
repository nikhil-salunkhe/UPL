import { useEffect, useState } from 'react';
import { getPlayers } from '../../services/playerService';
import { getOwners } from '../../services/ownerService';
import { getSponsors } from '../../services/sponsorService';
import { getTournament } from '../../services/tournamentService';
import Hero from '../../components/Hero/Hero';
import './Home.css';

const Home = () => {
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playersData, ownersData, sponsorsData, tournamentData] = await Promise.all([
          getPlayers(), getOwners(), getSponsors(), getTournament()
        ]);
        setPlayers(playersData);
        setOwners(ownersData);
        setSponsors(sponsorsData);
        setTournament(tournamentData);
      } catch (error) {
        console.error('Failed to load home data', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!tournament?.matchStartDate) return;

    const target = new Date(tournament.matchStartDate).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tournament]);

  const formatDate = (date) => {
    if (!date) return 'TBD';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'TBD';
    return d.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="home-page">
      <Hero />

      {tournament && (
        <section className="section tournament-section">
          <div className="section-heading">
            <p className="eyebrow">🏆 Tournament Schedule</p>
            <h2>Urul Premier League 2026</h2>
          </div>

          {tournament.matchStartDate && (
            <div className="countdown-grid">
              <div className="countdown-item">
                <strong>{countdown.days}</strong>
                <span>Days</span>
              </div>
              <div className="countdown-item">
                <strong>{countdown.hours}</strong>
                <span>Hours</span>
              </div>
              <div className="countdown-item">
                <strong>{countdown.minutes}</strong>
                <span>Minutes</span>
              </div>
              <div className="countdown-item">
                <strong>{countdown.seconds}</strong>
                <span>Seconds</span>
              </div>
            </div>
          )}

          <div className="tournament-details">
            <div className="detail-card">
              <span className="detail-icon">📅</span>
              <div>
                <strong>Auction Date</strong>
                <p>{formatDate(tournament.auctionDate)}</p>
              </div>
            </div>
            {tournament.matchStartDate && (
              <>
                <div className="detail-card">
                  <span className="detail-icon">🏏</span>
                  <div>
                    <strong>Match Dates</strong>
                    <p>{formatDate(tournament.matchStartDate)} → {formatDate(tournament.matchEndDate)}</p>
                  </div>
                </div>
                <div className="detail-card">
                  <span className="detail-icon">🏟️</span>
                  <div>
                    <strong>Venue</strong>
                    <p>{tournament.venue}</p>
                  </div>
                </div>
                <div className="detail-card">
                  <span className="detail-icon">📊</span>
                  <div>
                    <strong>Match Schedule</strong>
                    <p>{tournament.lotA} (Day {tournament.lotADay}) | {tournament.lotB} (Day {tournament.lotBDay})</p>
                  </div>
                </div>
              </>
            )}
            {!tournament.matchStartDate && (
              <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
                <span className="detail-icon">⏳</span>
                <div>
                  <strong>Match Details</strong>
                  <p style={{ color: '#ffd96f' }}>Match schedule will be announced after the auction.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="section stats-section">
        <div className="stat-card">
          <h3>{players.length + owners.length + sponsors.length}</h3>
          <p>Total Profiles</p>
        </div>
        <div className="stat-card">
          <h3>{players.length}</h3>
          <p>Total Players</p>
        </div>
        <div className="stat-card">
          <h3>{owners.length}</h3>
          <p>Total Owners</p>
        </div>
        <div className="stat-card">
          <h3>{sponsors.length}</h3>
          <p>Total Sponsors</p>
        </div>
      </section>
    </div>
  );
};

export default Home;