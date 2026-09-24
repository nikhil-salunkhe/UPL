import { useEffect, useState } from 'react';
import { getPlayers } from '../../services/playerService';
import { getOwners } from '../../services/ownerService';
import { getTournament } from '../../services/tournamentService';
import { apiBaseUrl } from '../../services/api';
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar';
import Hero from '../../components/Hero/Hero';
import './Home.css';

const getOwnerImageSrc = (owner) => {
  if (!owner.image) return '';
  if (owner.image.startsWith('data:') || owner.image.startsWith('http')) return owner.image;
  return `${apiBaseUrl}${owner.image.startsWith('/') ? owner.image : `/${owner.image}`}`;
};

const Home = () => {
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playersData, ownersData, tournamentData] = await Promise.all([
          getPlayers(), getOwners(), getTournament()
        ]);
        setPlayers(playersData);
        setOwners(ownersData);
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

      <section className="section teams-section">
        <div className="section-heading">
          <p className="eyebrow">Teams & Leaders</p>
          <h2>Teams, Owners & Captains</h2>
        </div>

        {owners.length === 0 ? (
          <div className="status-card">Teams will be announced after the auction.</div>
        ) : (
          <div className="teams-grid">
            {owners.map((owner) => {
              const captainPlayer = players.find((player) => player.name === owner.captain);
              const viceCaptainPlayer = players.find((player) => player.name === owner.viceCaptain);
              const ownerImage = getOwnerImageSrc(owner);

              return (
                <article className="team-card" key={owner._id}>
                  <div className="team-card-top">
                    {ownerImage ? (
                      <img className="team-logo" src={ownerImage} alt={owner.team || owner.name} />
                    ) : (
                      <span className="team-logo team-logo-fallback">🏆</span>
                    )}
                    <div className="team-card-title">
                      <h3>{owner.team || 'Team TBA'}</h3>
                      <p>Owner: {owner.name}</p>
                    </div>
                  </div>

                  <div className="team-leaders">
                    <div className="leader-row">
                      <span className="leader-badge c">C</span>
                      {owner.captain && <PlayerAvatar player={captainPlayer} name={owner.captain} size={26} />}
                      <span className={`leader-name${owner.captain ? '' : ' empty'}`}>
                        {owner.captain || 'To be announced'}
                      </span>
                    </div>
                    <div className="leader-row">
                      <span className="leader-badge vc">VC</span>
                      {owner.viceCaptain && <PlayerAvatar player={viceCaptainPlayer} name={owner.viceCaptain} size={26} />}
                      <span className={`leader-name${owner.viceCaptain ? '' : ' empty'}`}>
                        {owner.viceCaptain || 'To be announced'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;