import { CampusMap } from "./CampusMap";

export default function Home() {
  return (
    <main className="campaign-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Maxime Hendryx-Parker campaign">
          <span>MAXIME</span>
          <span>HENDRYX-PARKER</span>
        </a>
        <p className="role">CTSG / TECHNICAL CO-PRESIDENT</p>
      </header>

      <section
        className="campus-study"
        id="top"
        aria-label="2026 Cornell Tech Student Government campaign"
      >
        <CampusMap />

        <div className="study-frame" aria-hidden="true" />

        <div className="study-title">
          <h1>
            <span>MAXIME FOR</span>
            <span>TECHNICAL CO-PRESIDENT</span>
          </h1>
        </div>

        <div className="study-meta">
          <p>ROOSEVELT ISLAND, NYC</p>
          <p>UNITED STATES</p>
        </div>

        <div className="coordinate-mark" aria-hidden="true">
          <span>40.7546 N</span>
          <span>73.9572 W</span>
        </div>
      </section>

      <footer className="study-footer">
        <span>CORNELL TECH / 2026</span>
        <a
          className="footer-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap contributors © CARTO
        </a>
      </footer>
    </main>
  );
}
