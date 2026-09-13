import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RunicBackground } from "@/app/(site)/calendar/RunicBackground";
import styles from "./platform.module.css";

export const metadata: Metadata = {
  title: "The Suwanee Gamers Platform",
  description:
    "Tour the living campaign platform behind Suwanee Gamers: Chronicles, Myra, the live Myrdae map, and tools built for Dungeon Masters.",
  robots: { index: false, follow: false },
};

const WORLD_ROUTES = [
  [
    "Campaign Pages",
    "Every active campaign, its DM, its schedule, and its full session history — plus a retired-campaign archive that never disappears, just steps aside.",
  ],
  [
    "Myrdae in Motion",
    "An interactive journey view that draws each party’s route automatically from its session notes.",
  ],
  [
    "The Library",
    "A full immersive Chronicle reader, built from the same living lore vault Myra draws from.",
  ],
  [
    "Bestiary, Pantheon & History",
    "The setting’s reference spine — creatures, gods, and the timeline that ties it all together.",
  ],
  [
    "Territories & Gazetteer",
    "The political map and settlement-by-settlement detail, kept current as the world changes.",
  ],
  [
    "Calendar & Store",
    "The shared session calendar and the group’s own merch shelf, live inventory included.",
  ],
] as const;

const MYRA_PATHS = [
  [
    "01",
    "She hears and orients",
    "Real-time voice becomes text, fantasy names are corrected through a living pronunciation dictionary, and the current page and signed-in member travel with the conversation.",
  ],
  [
    "02",
    "She chooses how to think",
    "Dates, recaps, learned answers, and navigation take fast factual paths. Questions that need judgment or lore fall through to grounded reasoning and Chronicle search.",
  ],
  [
    "03",
    "She speaks and guides",
    "The answer returns in the member’s chosen voice and personality. Myra can keep hold of the subject, answer a follow-up, or guide the member to the right place in the portal.",
  ],
] as const;

const MYRA_CAPABILITIES = [
  [
    "Layered memory",
    "Not one giant prompt",
    "Myra keeps the live calendar, group wiki, campaign recaps, searchable Chronicles, recent site changes, and learned answers in separate compartments so dates, lore, and operations do not blur together.",
  ],
  [
    "Grounded reasoning",
    "Canon before confidence",
    "For a character, place, god, symbol, or event, she searches the authorized Chronicle sources first. If the answer is not documented, she says so instead of filling the silence with invented lore.",
  ],
  [
    "Situational awareness",
    "The portal is part of the conversation",
    "She knows the member’s profile, campaign access, current page, and the subject already being discussed. “Tell me about this” can mean the page in front of you, not a conversation restarted from zero.",
  ],
  [
    "Health and recovery",
    "She knows when something is wrong",
    "Myra watches the systems that let her think, remember, hear, speak, and reach the website. She distinguishes healthy, degraded, and unavailable states, records incidents, and recognizes recoveries.",
  ],
  [
    "A nightly learning loop",
    "Questions become durable knowledge",
    "She reviews real questions she had to reason through or could not answer, searches again for cited evidence, promotes grounded answers into fast memory, and keeps unsolved questions visible as knowledge gaps.",
  ],
  [
    "Guarded self-healing",
    "Growth with a safety boundary",
    "She can apply reversible, evidence-backed fixes to learned answers, mishearings, and pronunciations. Missing source material and routing changes stay queued for a human instead of being silently invented or rewritten.",
  ],
] as const;

const MAP_FEATURES = [
  [
    "01",
    "Surface and Underdark",
    "Switch between two complete realms without leaving the atlas. Each has its own settlements, routes, geography, and atmosphere.",
  ],
  [
    "02",
    "Legend and search",
    "Find a named place, learn the map’s symbols, and move straight to the part of Myrdae you need.",
  ],
  [
    "03",
    "Locations and lore",
    "Reveal the world’s labeled settlements and landmarks, then inspect the places that matter to the campaigns.",
  ],
  [
    "04",
    "Territory overlays",
    "Turn political boundaries on and off to see which realm claims the ground beneath every road and settlement.",
  ],
  [
    "05",
    "Travel tools",
    "Use the coordinate tracker, hex grid, ruler, roads, and water routes to make distance and travel part of play.",
  ],
  [
    "06",
    "Advents Guide",
    "Inside the member portal, characters can rate and review settlements and businesses entirely in-world.",
  ],
] as const;

const AUTOMATION = [
  [
    "Keep notes where you already keep them",
    "A Google Doc per campaign, written the way you already write it. Nothing site-specific to learn.",
  ],
  [
    "Synced daily, automatically",
    "Curated notes and raw notes both flow in on a schedule. Official write-ups always win over auto-summarized material.",
  ],
  [
    "A living Chronicle, self-assembled",
    "A session Doc becomes a complete, image-rich Chronicle page — no formatting and no copy-paste.",
  ],
  [
    "The journey map draws itself",
    "Session summaries plot a party’s path on the world map automatically. No one drags a pin.",
  ],
] as const;

const UNDERSTANDING = [
  [
    "Audience & Acquisition",
    "Who is visiting, how they arrived, and whether it is the same handful of regulars or the whole table.",
  ],
  [
    "Content & Journeys",
    "Which campaign, session, or Chronicle gets read — and for how long, not just whether it loaded.",
  ],
  [
    "Map engagement",
    "Whether players are actually exploring the living map between sessions, with verified location interactions kept distinct from page views.",
  ],
  [
    "Search & gaps",
    "What players search for and do not find — a direct signal for what the world still needs written.",
  ],
] as const;

const OLD_WAY = [
  "A wiki that is accurate the week it is written, and never again",
  "Session notes scattered across Discord, a Doc nobody re-reads, and someone’s memory",
  "A static map image, redrawn by hand when the world changes",
  "Zero idea whether players read any of it between sessions",
  "A generic chatbot that answers confidently and wrong",
];

const SUWANEE_WAY = [
  "Campaign pages that rebuild themselves from the notes you already take",
  "One living Chronicle per campaign, always current and in one place",
  "A live map with two realms, travel tools, location detail, and in-world reviews",
  "Honest, labeled analytics on exactly what the table engages with",
  "A voice guide that looks lore up in your world instead of guessing",
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className={styles.eyebrow}>{children}</span>;
}

function DetailCard({
  marker,
  title,
  description,
}: {
  marker: string;
  title: string;
  description: string;
}) {
  return (
    <article className={styles.feature}>
      <span className={styles.featureMarker}>{marker}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

export default function PlatformPage() {
  return (
    <div className={styles.page}>
      <RunicBackground prominentLightning />
      <div className={styles.lightningField} aria-hidden="true">
        <svg viewBox="0 0 1600 900" preserveAspectRatio="none">
          <path d="M1540 -40 1380 142 1441 136 1278 338 1350 326 1115 625" />
          <path d="M48 -35 205 136 154 132 326 315 264 304 472 548" />
        </svg>
      </div>
      <div className={styles.veil} aria-hidden="true" />

      <header className={styles.bar}>
        <Link className={styles.wordmark} href="/signin">
          <span aria-hidden="true">◆</span>
          <span>Suwanee Gamers</span>
        </Link>
        <nav aria-label="Platform tour" className={styles.nav}>
          <a href="#world">The World</a>
          <a href="#myra">Myra</a>
          <a href="#map">The Map</a>
          <a href="#dms">For DMs</a>
          <a href="#versus">Old Way / New Way</a>
        </nav>
        <Link className={styles.enterLink} href="/signin">
          Enter the portal
        </Link>
      </header>

      <main>
        <section className={`${styles.wrap} ${styles.hero}`}>
          <div className={styles.heroGrid}>
            <div>
              <Eyebrow>The next campaign hub</Eyebrow>
              <h1>
                Your table deserves a home that’s <em>alive</em>, not a wiki
                that goes stale.
              </h1>
              <p className={styles.lede}>
                Suwanee Gamers is what happens when a real six-campaign table
                stops fighting its own tools. Session notes write themselves
                into Chronicles. A voice guide answers lore questions grounded
                in your own world. The map is live, detailed, and always
                evolving. And for the first time, a Dungeon Master can see what
                the table is actually paying attention to.
              </p>
              <div className={styles.actions}>
                <a className={`${styles.button} ${styles.solid}`} href="#dms">
                  See what it does for DMs
                </a>
                <a className={`${styles.button} ${styles.ghost}`} href="#map">
                  See the Map of Myrdae
                </a>
              </div>
            </div>

            <aside className={styles.myraDemo} aria-label="Example Myra conversation">
              <div className={styles.demoHead}>
                <span className={styles.dots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Ask Myra — example</span>
              </div>
              <div className={styles.demoBody}>
                <p><b>You</b><span>Who is Draelith, and why does Therric hate him?</span></p>
                <p><b>Myra</b><span>Looked up in the world’s own Chronicle, not guessed — Draelith led the betrayal at…</span></p>
                <p><b>You</b><span>When’s our next session?</span></p>
                <p><b>Myra</b><span>Straight from the real schedule. Thursday, 7:00 PM.</span></p>
              </div>
            </aside>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.block}`} id="world">
          <div className={styles.blockHead}>
            <Eyebrow>Chapter I</Eyebrow>
            <h2>One doorway. A whole living setting.</h2>
            <p>
              Suwanee Gamers isn’t a place lore gets typed once and forgotten.
              It is the front door to a setting that keeps growing. Every page
              below is real, live, and current.
            </p>
          </div>
          <ul className={styles.routeList}>
            {WORLD_ROUTES.map(([title, description]) => (
              <li key={title}>
                <strong>{title}</strong>
                <span>{description}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${styles.wrap} ${styles.block}`} id="myra">
          <div className={styles.blockHead}>
            <Eyebrow>Chapter II</Eyebrow>
            <h2>Myra isn’t a chatbot. She is the living voice of the portal.</h2>
            <p>
              Talking is only the surface. Behind the voice is a system that
              knows where you are, decides what kind of answer the moment needs,
              remembers the right things in the right places, and can explain
              when part of itself is not working.
            </p>
          </div>

          <blockquote className={styles.myraManifesto}>
            <span aria-hidden="true">“</span>
            <p>
              Most sites have a chatbot. Myra is a voice to a portal where
              fantasy becomes reality.
            </p>
          </blockquote>

          <div className={styles.myraFlow} aria-label="How Myra handles a conversation">
            {MYRA_PATHS.map(([marker, title, description]) => (
              <article key={title}>
                <span>{marker}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>

          <div className={styles.myraSectionHead}>
            <Eyebrow>What lives beneath the voice</Eyebrow>
            <h3>Built to reason, remember, notice, and grow.</h3>
          </div>
          <div className={styles.myraCapabilityGrid}>
            {MYRA_CAPABILITIES.map(([marker, title, description]) => (
              <DetailCard key={title} marker={marker} title={title} description={description} />
            ))}
          </div>

          <aside className={styles.myraTrust}>
            <div>
              <Eyebrow>The difference is restraint</Eyebrow>
              <h3>She grows from evidence, not imagination.</h3>
            </div>
            <p>
              Myra’s memory is sourced, her access follows the signed-in member,
              and her automatic fixes are limited to changes that are grounded,
              reversible, and auditable. The goal is not to sound certain. It is
              to be useful without breaking trust with the table or the world.
            </p>
          </aside>
        </section>

        <section className={`${styles.wrap} ${styles.block}`} id="map">
          <div className={styles.blockHead}>
            <Eyebrow>Chapter III — the center of it all</Eyebrow>
            <h2>The map isn’t a feature. It’s where the world actually is.</h2>
            <p>
              Every settlement, road, territory, and campaign journey begins
              here. These are static views of the real Map of Myrdae — the
              entire world and a close look at the lore a location can reveal.
              No interactive map controls are exposed on this public tour.
            </p>
          </div>

          <div className={styles.mapGallery}>
            <figure className={styles.mapFigure}>
              <div className={styles.mapFigureHead}>
                <span>Full world view</span>
                <span>Static preview</span>
              </div>
              <div className={styles.fullMapImage}>
                <Image
                  src="/media/images/maps-of-myrdae/locations-map.webp"
                  alt="The complete Map of Myrdae with its labeled continents, seas, settlements, and landmarks"
                  fill
                  priority
                  sizes="(max-width: 1180px) 92vw, 1120px"
                />
              </div>
              <figcaption>The entire surface map, shown edge to edge.</figcaption>
            </figure>

            <figure className={`${styles.mapFigure} ${styles.tooltipFigure}`}>
              <div className={styles.mapFigureHead}>
                <span>Location lore</span>
                <span>Actual tooltip</span>
              </div>
              <div className={styles.tooltipScene}>
                <Image
                  src="/media/images/maps-of-myrdae/locations-map.webp"
                  alt="A closer view of the Dunduar region on the Map of Myrdae"
                  fill
                  sizes="(max-width: 760px) 92vw, 700px"
                />
                <aside className={styles.mapTooltip} aria-label="Actual map tooltip for Dunduar">
                  <div className={styles.tooltipCrestHeader}>
                    <Image
                      src="/media/images/gazetteer/cities/dunduar.webp"
                      alt="Dunduar crest"
                      width={120}
                      height={120}
                    />
                    <div className={styles.tooltipNameplate}>Dunduar</div>
                  </div>
                  <div className={styles.tooltipBody}>
                    <dl className={styles.tooltipMeta}>
                      <div><dt>Type</dt><dd>Mid-sized Settlement</dd></div>
                      <div><dt>Territory</dt><dd>Baltwood</dd></div>
                      <div><dt>Biome</dt><dd>Mountains</dd></div>
                      <div><dt>Disposition</dt><dd className={styles.friendly}>Friendly</dd></div>
                      <div><dt>Advents Rating</dt><dd>☆☆☆☆☆ <small>Not yet rated</small></dd></div>
                    </dl>
                    <p className={styles.tooltipDescription}>
                    Founded centuries ago, Dunduar is known across Myrdae for
                    rich veins of iron and silver, and the rare magical metal
                    Dunduar Ore.
                    </p>
                    <div className={styles.tooltipRoads}>
                      <span>Connected By Road</span>
                      <strong>Ulgrey</strong>
                      <small>154 mi · 6.4 days</small>
                      <em>Approximate miles and horse-cart travel days.</em>
                    </div>
                    <span className={styles.cityMapBadge}>◐ City Map</span>
                  </div>
                </aside>
              </div>
              <figcaption>
                Dunduar’s actual current tooltip, rendered as a non-interactive preview.
              </figcaption>
            </figure>
          </div>

          <div className={`${styles.featureGrid} ${styles.mapFeatureGrid}`}>
            {MAP_FEATURES.map(([marker, title, description]) => (
              <DetailCard key={title} marker={marker} title={title} description={description} />
            ))}
          </div>

          <div className={styles.journeysPanel}>
            <div>
              <Eyebrow>Myrdae in Motion</Eyebrow>
              <h3>Watch the world change as every campaign moves through it.</h3>
            </div>
            <p>
              Every session a DM writes plots itself onto the map automatically.
              Scrub a timeline through a campaign’s history, see each party’s
              current position on its own colored trail, and read the World
              Pulse to learn what changed and where. Separate tables share one
              world that visibly remembers all of them.
            </p>
            <Link href="/signin?from=%2Fcampaign-journeys">Enter to view campaign journeys →</Link>
          </div>
        </section>

        <section className={`${styles.block} ${styles.dmBlock}`} id="dms">
          <div className={styles.wrap}>
            <div className={styles.dmTitle}>
              <span aria-hidden="true">◆</span>
              <Eyebrow>The part built for you</Eyebrow>
            </div>
            <h2 className={styles.dmHeading}>This is the part every other platform is missing.</h2>
            <p className={styles.dmLede}>
              A wiki tells you what happened last session. Suwanee Gamers tells
              you what your players are actually doing with it — which pages
              they return to, how long they linger on a Chronicle, and whether
              they are exploring the map. That is the difference between
              guessing what your table cares about and knowing.
            </p>

            <div className={styles.dmGrid}>
              {[
                ["Automation", "Your campaign page fills itself in.", AUTOMATION, "→"],
                ["Understanding", "Know your table like never before.", UNDERSTANDING, "◆"],
              ].map(([label, title, rows, icon]) => (
                <article className={styles.dmCard} key={label as string}>
                  <header>
                    <Eyebrow>{label as string}</Eyebrow>
                    <h3>{title as string}</h3>
                  </header>
                  <div className={styles.dmRows}>
                    {(rows as typeof AUTOMATION).map(([rowTitle, description]) => (
                      <div className={styles.dmRow} key={rowTitle}>
                        <span aria-hidden="true">{icon as string}</span>
                        <div><h4>{rowTitle}</h4><p>{description}</p></div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <aside className={styles.honesty}>
              <Eyebrow>Insight, not vanity metrics</Eyebrow>
              <p>
                The DM dashboard follows one rule: do not show a number unless
                it means exactly what it says.
              </p>
              <ul>
                <li>Internal testing and DM development traffic are never recorded.</li>
                <li>A missing interaction signal is labeled as missing coverage, not “no interest.”</li>
                <li>Page opens, searches, clicks, and media plays remain separate measures.</li>
                <li>Every figure states its definition in plain language beside the chart.</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.block}`} id="versus">
          <div className={styles.blockHead}>
            <Eyebrow>The comparison</Eyebrow>
            <h2>What most tables stitch together — and what one platform replaces.</h2>
          </div>
          <div className={styles.versus}>
            <div>
              <span>The usual toolkit</span>
              <ul>{OLD_WAY.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
            <div className={styles.newWay}>
              <span>Suwanee Gamers</span>
              <ul>{SUWANEE_WAY.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.closing}`}>
          <Eyebrow>The takeaway</Eyebrow>
          <h2>This is what a campaign hub looks like when it is built by DMs who were tired of duct tape.</h2>
          <p>
            Suwanee Gamers started as one group’s six campaigns. What it became
            is a working answer to the question every DM eventually asks:
            <em> where does all of this actually live?</em>
          </p>
          <div className={styles.actions}>
            <Link className={`${styles.button} ${styles.solid}`} href="/signin">Enter the portal</Link>
            <a className={`${styles.button} ${styles.ghost}`} href="#world">Start the tour again</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.wrap}>
          <span>◆ Suwanee Gamers</span>
          <p>Built for one table’s six campaigns — and everything here is a real, running feature.</p>
        </div>
      </footer>
    </div>
  );
}
