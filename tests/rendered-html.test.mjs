import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CTSG campaign landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Maxime Hendryx-Parker \| CTSG<\/title>/i);
  assert.match(
    html,
    /Maxime Hendryx-Parker for Cornell Tech Student Government Technical Co-President\./,
  );
  assert.match(html, /MH2682@CORNELL\.EDU/);
  assert.match(html, /@MAXIMEHP_/);
  assert.match(
    html,
    /<span>MAXIME FOR<\/span><span>TECHNICAL CO-PRESIDENT<\/span>/,
  );
  assert.match(html, /LOADING ASSETS/);
  assert.doesNotMatch(html, /VISUAL DIRECTION ONLY|CAMPAIGN SITE \/ IN FORMATION/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("defines accessible campaign sections instead of generic information markers", async () => {
  const [campusMap, page, css] = await Promise.all([
    readFile(new URL("../app/CampusMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const section of ["BIO", "ROLE", "PRIORITIES", "COMMUNITY"]) {
    assert.match(campusMap, new RegExp(`title: "${section}"`));
  }

  assert.match(campusMap, /aria-label=\{`Open \$\{section\.title\}`\}/);
  assert.match(campusMap, /aria-label=\{`\$\{section\.title\} campaign section`\}/);
  assert.match(campusMap, /LOADING ASSETS/);
  assert.match(page, /2026 Cornell Tech Student Government campaign/);
  assert.match(page, /CORNELL TECH \/ 2026/);
  assert.doesNotMatch(page, /CTSG 2026 CAMPAIGN|LISTEN\.|REPRESENT\.|ACT\./);
  assert.match(css, /\.building-marker__content/);
  assert.match(css, /\.building-marker--active \.building-marker__content/);
  assert.match(campusMap, /String\(sectionIndex \+ 1\)\.padStart\(2, "0"\)/);
  assert.match(campusMap, /SECTION_BUILDING_ORDER = \[3, 2, 0, 1\]/);
  assert.match(campusMap, /"CLOSE"/);
  assert.match(campusMap, /panelShiftX/);
  assert.match(css, /var\(--panel-shift-x\)/);
  assert.match(campusMap, /src: "\/maxime-headshot\.png"/);
  assert.match(campusMap, /attended and volunteered at many conferences/);
  assert.match(css, /width: var\(--marker-label-width\)/);
  assert.doesNotMatch(campusMap, /aria-hidden="true">i<\//);
});
