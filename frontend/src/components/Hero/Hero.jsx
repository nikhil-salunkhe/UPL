import './Hero.css';

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-overlay" />
      <div className="hero-content">
        <p className="eyebrow">उरूल प्रीमियर लीग(UPL) </p>
        <h1>URUL PREMIER LEAGUE 2026</h1>
        <p className="hero-subtitle">A weekend of fierce competition, raw talent, and neighborhood pride.</p>
        <div className="hero-meta">
          <span>📍 जुगाइदेवी स्टेडियम उरूल</span>
          <span>🏘️ ऊरूल </span>
        </div>
      </div>
    </section>
  );
};

export default Hero;
