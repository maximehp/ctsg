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

      <section className="campus-study" id="top" aria-label="Cornell Tech campus study">
        <CampusMap />

        <div className="study-frame" aria-hidden="true" />

        <div className="study-title">
          <p>01 / CAMPUS STUDY</p>
          <h1>
            CORNELL<br />
            TECH
          </h1>
        </div>

        <div className="study-meta">
          <p>ROOSEVELT ISLAND, NYC</p>
          <p>CAMPAIGN SITE / IN FORMATION</p>
        </div>

        <div className="coordinate-mark" aria-hidden="true">
          <span>40.7546 N</span>
          <span>73.9572 W</span>
        </div>
      </section>

      <footer className="study-footer">
        <span>VISUAL DIRECTION ONLY</span>
        <span>2026</span>
      </footer>
    </main>
  );
}
