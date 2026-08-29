import { CampusMap } from "./CampusMap";

export default function Home() {
  return (
    <main className="campaign-shell">
      <header className="site-header">
        <a
          className="wordmark"
          href="mailto:mh2682@cornell.edu"
          aria-label="Email Maxime Hendryx-Parker"
        >
          <span>MH2682@CORNELL.EDU</span>
        </a>
        <a
          className="role"
          href="https://www.instagram.com/maximehp_/"
          target="_blank"
          rel="noreferrer"
          aria-label="Follow Maxime Hendryx-Parker on Instagram"
        >
          @MAXIMEHP_
        </a>
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
