import { useEffect, useState } from 'react';
import { getPlayers } from '../../services/playerService';
import { getOwners } from '../../services/ownerService';
import { getTournament } from '../../services/tournamentService';
import { getAdvertisements } from '../../services/advertisementService';
import { getRules } from '../../services/ruleService';
import { apiBaseUrl, ownerImageUrl, advertisementImageUrl } from '../../services/api';
import PlayerAvatar from '../../components/PlayerAvatar/PlayerAvatar';
import Hero from '../../components/Hero/Hero';
import './Home.css';

const getOwnerImageSrc = (owner) => {
  // The list endpoint no longer embeds the base64 photo (it made the response
  // ~4 MB and timed out). Load each team logo on demand from its id. Older or
  // admin responses may still carry an inline data URL / path — honour those.
  if (owner.image) {
    if (owner.image.startsWith('data:') || owner.image.startsWith('http')) return owner.image;
    if (owner.image.startsWith('/')) return `${apiBaseUrl}${owner.image}`;
  }
  return owner._id ? ownerImageUrl(owner._id) : '';
};

const cleanLeaderName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Guard against corrupted records where an image data URL was saved as captain
  if (/^(data|blob|https?):/i.test(trimmed) || trimmed.length > 80) return '';
  return trimmed;
};

// Friendly inline error + retry shown for a single home section when its
// endpoint fails. Keeps the rest of the page usable.
const SectionError = ({ onRetry, loading }) => (
  <div className="status-card section-error">
    <span>Could not load this section right now.</span>
    <button
      type="button"
      className="retry-btn"
      onClick={onRetry}
      disabled={loading}
    >
      {loading ? 'Retrying...' : 'Retry'}
    </button>
  </div>
);

// Team logo with a graceful fallback: if the on-demand image request 404s
// (owner has no photo), show the trophy placeholder instead of a broken image.
const TeamLogo = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="team-logo team-logo-fallback">🏆</span>;
  }
  return (
    <img
      className="team-logo"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

const Home = () => {
  const [players, setPlayers] = useState([]);
  const [owners, setOwners] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [advertisements, setAdvertisements] = useState([]);
  const [rules, setRules] = useState([]);

  // Per-section loading + error state. Each home section is fetched
  // independently so a single slow/failing endpoint (e.g. the large /owners
  // payload or a Render cold start) never hides the other successfully loaded
  // sections. allSettled guarantees every section resolves on its own.
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // Reusable per-section loader. `key` matches a home section; `loader` is the
  // service call; `onOk` stores the resolved data.
  const loadSection = async (key, loader, onOk) => {
    try {
      const data = await loader();
      onOk(data);
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      console.error(`Failed to load ${key}`, error);
      setErrors((prev) => ({ ...prev, [key]: true }));
    }
  };

  const fetchData = () => {
    const sections = [
      ['players', getPlayers, (d) => setPlayers(d || [])],
      ['owners', getOwners, (d) => setOwners(d || [])],
      ['tournament', getTournament, (d) => setTournament(d || null)],
      ['advertisements', getAdvertisements, (d) => setAdvertisements(d || [])],
      ['rules', getRules, (d) => setRules(d || [])]
    ];

    // Each section resolves on its own; only flip the shared loading flag off
    // in the async .then so we never setState synchronously inside the effect.
    return Promise.allSettled(
      sections.map(([key, loader, onOk]) => loadSection(key, loader, onOk))
    ).then(() => setLoading(false));
  };

  // Retry is triggered from a click handler, so setting loading here is safe.
  const retry = () => {
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {errors.tournament && !tournament ? (
        <section className="section tournament-section">
          <div className="section-heading">
            <h2>Tournament</h2>
          </div>
          <SectionError onRetry={retry} loading={loading} />
        </section>
      ) : tournament && (
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

        {errors.owners ? (
          <SectionError onRetry={retry} loading={loading} />
        ) : owners.length === 0 ? (
          <div className="status-card">Teams will be announced after the auction.</div>
        ) : (
          <div className="teams-grid">
            {[...owners]
              .sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0))
              .map((owner) => {
                const captain = cleanLeaderName(owner.captain);
              const viceCaptain = cleanLeaderName(owner.viceCaptain);
              const captainPlayer = captain ? players.find((player) => player.name === captain) : undefined;
              const viceCaptainPlayer = viceCaptain ? players.find((player) => player.name === viceCaptain) : undefined;
              const ownerImage = getOwnerImageSrc(owner);

              return (
                <article className="team-card" key={owner._id}>
                  <div className="team-card-top">
                    <TeamLogo src={ownerImage} alt={owner.team || owner.name} />
                    <div className="team-card-title">
                      <h3>{owner.team || 'Team TBA'}</h3>
                      <p>Owner: {owner.name}</p>
                    </div>
                  </div>

                  <div className="team-leaders">
                    <div className="leader-row">
                      <span className="leader-badge c">C</span>
                      {captain && <PlayerAvatar player={captainPlayer} name={captain} size={26} />}
                      <span className={`leader-name${captain ? '' : ' empty'}`}>
                        {captain || 'To be announced'}
                      </span>
                    </div>
                    <div className="leader-row">
                      <span className="leader-badge vc">VC</span>
                      {viceCaptain && <PlayerAvatar player={viceCaptainPlayer} name={viceCaptain} size={26} />}
                      <span className={`leader-name${viceCaptain ? '' : ' empty'}`}>
                        {viceCaptain || 'To be announced'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="section ads-section">
        <div className="section-heading">
          <p className="eyebrow">📢 Advertisements</p>
          <h2>Team Advertisements</h2>
        </div>

        <div className="ads-slider">
          {errors.advertisements ? (
            <SectionError onRetry={retry} loading={loading} />
          ) : advertisements.length === 0 ? (
            <div className="no-items">No advertisements published yet.</div>
          ) : (
            advertisements.map((ad) => {
              // Banner is loaded on demand from its id (list no longer embeds it).
              const bannerSrc = ad.banner
                ? (ad.banner.startsWith('data:') || ad.banner.startsWith('http') || ad.banner.startsWith('/')
                    ? (ad.banner.startsWith('/') ? `${apiBaseUrl}${ad.banner}` : ad.banner)
                    : advertisementImageUrl(ad._id))
                : advertisementImageUrl(ad._id);
              return (
              <article className="ad-card" key={ad._id}>
                {bannerSrc ? (
                  <a
                    href={ad.link || '#'}
                    target={ad.link ? '_blank' : undefined}
                    rel={ad.link ? 'noopener noreferrer' : undefined}
                  >
                    <img src={bannerSrc} alt={ad.title || ad.team} loading="lazy" />
                  </a>
                ) : (
                  <div className="ad-placeholder">No banner</div>
                )}
                <div className="ad-card-body">
                  <strong>{ad.team || 'Untitled'}</strong>
                  <p>{ad.title || 'No title'}</p>
                  {ad.link && (
                    <a href={ad.link} target="_blank" rel="noopener noreferrer">
                      Visit link →
                    </a>
                  )}
                </div>
              </article>
              );
            })
          )}
        </div>
      </section>

      <section className="section rules-section">
        <div className="section-heading">
          <p className="eyebrow">📜 Rules</p>
          <h2>Tournament Rules</h2>
        </div>

        {errors.rules ? (
          <SectionError onRetry={retry} loading={loading} />
        ) : rules.length === 0 ? (
          <div className="no-items">No rules published yet.</div>
        ) : (
          <div className="rules-grid">
            {rules.map((rule) => (
              <div className="rule-card" key={rule._id}>
                <span className="rule-category">{rule.category}</span>
                <h3>{rule.title}</h3>
                <p>{rule.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>


    </div>
  );
};

export default Home;