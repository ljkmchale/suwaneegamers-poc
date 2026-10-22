import type { Metadata } from "next";
import Image from "next/image";
import { getAdminSession } from "@/lib/adminSession";
import { getWarcraftHub } from "@/lib/wowForever";
import { addWarcraftNight, deleteWarcraftNight, updateWarcraftHub } from "./actions";
import styles from "./warcraft.module.css";

export const metadata: Metadata = { title: "WoW Forever", description: "Our weekly World of Warcraft: Forever adventures, party roster, plans, and game-night journal." };

type IconKind = "swords" | "scroll" | "compass" | "shield" | "calendar" | "crystal";
const iconPositions: Record<IconKind, string> = {
  swords: "0% 0%", scroll: "50% 0%", compass: "100% 0%",
  shield: "0% 100%", calendar: "50% 100%", crystal: "100% 100%",
};

function PaintedIcon({ kind, size = 32 }: { kind: IconKind; size?: number }) {
  return <span aria-hidden="true" className={styles.paintedIcon} style={{ width: size, height: size, backgroundPosition: iconPositions[kind] }} />;
}

export default async function WarcraftPage() {
  const hub = getWarcraftHub();
  const admin = (await getAdminSession()).isAdmin === true;
  const confirmed = hub.players.filter(p => p.status === "Confirmed").length;
  return <div className={styles.page}>
    <header className={styles.hero}>
      <div className={styles.heroArtwork}>
        <Image src="/media/images/wow-forever/blizzard-forever-key-art-v1.webp" alt="Blizzard’s World of Warcraft: Forever key art: adventurers overlooking Azeroth’s forests, towers, and mountains beneath a violet and golden sky." width={1600} height={1725} sizes="(max-width: 700px) 100vw, 1132px" priority />
      </div>
      <div className={styles.sigil}><PaintedIcon kind="swords" size={112} /></div>
      <p className={styles.eyebrow}>Suwanee Gamers · Our PC game night</p>
      <h1>World of Warcraft<span>Forever</span></h1>
      <p className={styles.tagline}>New characters. Familiar friends. A whole world of trouble.</p>
      <p className={styles.intro}>Our own little corner of Azeroth. Gather the party, make a plan, and keep the stories from every game night here.</p>
      <div className={styles.actions}><a href="https://discord.com/channels/319954674188943362/325247957932834816" target="_blank" rel="noopener noreferrer">Join us on Discord ↗</a><a href="#party">Meet the party <PaintedIcon kind="shield" size={28} /></a><a href="#journal">Adventure log <PaintedIcon kind="scroll" /></a></div>
      <div className={styles.stats}><span><strong>{confirmed}</strong> adventurers{hub.players.length > confirmed ? ` + ${hub.players.length - confirmed} maybe` : ""}</span><span><strong>Weekly</strong> give or take real life</span><span><strong>{hub.nights.length}</strong> nights in the log</span></div>
    </header>

    <div className={styles.planning}>
      <section className={styles.card}><p className={styles.eyebrow}><PaintedIcon kind="calendar" /> Next time we log in</p><h2>{hub.nextNight}</h2><p>{hub.schedule}</p><div className={styles.objective}><PaintedIcon kind="crystal" /><p>{hub.objective}</p></div></section>
      <section className={styles.card}><p className={styles.eyebrow}><PaintedIcon kind="compass" /> Our corner of Azeroth</p><dl className={styles.details}><div><dt>Realm</dt><dd>{hub.realm}</dd></div><div><dt>Faction</dt><dd>{hub.faction}</dd></div></dl><p className={styles.small}>One party, one shared adventure. We’ll fill in the details as the crew decides.</p></section>
    </div>

    <section id="party" className={styles.section}><p className={styles.eyebrow}><PaintedIcon kind="shield" /> The party roster</p><h2>Good company. Great adventures.</h2><p className={styles.subtitle}>The crew taking on Azeroth, one game night at a time.</p>
      <div className={styles.roster}>{hub.players.map(player => <article className={`${styles.player} ${player.status === "Maybe" ? styles.maybe : ""}`} key={player.name}><div className={styles.playerTop}><span className={styles.initial} aria-hidden="true">{player.name.slice(0, 1)}</span><span className={styles.badge}>{player.status === "Maybe" ? "Maybe joining" : "In the party"}</span></div><h3>{player.name}</h3><p className={styles.className}>{player.className}</p><p>{player.character || "Character name to come"}</p><p className={styles.small}>{player.level ? `Level ${player.level}` : "Adventure starts here"}</p></article>)}</div>
    </section>

    <section id="journal" className={styles.section}><p className={styles.eyebrow}><PaintedIcon kind="scroll" /> The adventure log</p><h2>For the stories we’ll tell later.</h2><p className={styles.subtitle}>Quest progress, dungeon victories, memorable loot, and the occasional spectacular wipe.</p>
      <figure className={styles.journalArtwork}><Image src="/media/images/wow-forever/azeroth-painted-road-v2.webp" alt="A hand-painted Warcraft-inspired landscape with a timber inn, winding road, pine forest, distant towers, and a lake valley beneath a warm violet sunset." width={1774} height={887} sizes="(max-width: 700px) 100vw, 1132px" /><figcaption>Every adventure begins with a road and good company.</figcaption></figure>
      {hub.nights.length === 0 ? <div className={`${styles.card} ${styles.empty}`}><PaintedIcon kind="swords" size={72} /><h3>The first chapter is still ahead.</h3><p>Once we’ve played our first night, our recap goes here. Until then: assemble the party.</p></div> : <div className={styles.log}>{hub.nights.map(night => <article className={styles.card} key={night.id}><time dateTime={night.date} className={styles.eyebrow}>{night.date}</time><h3>{night.title}</h3><p className={styles.notes}>{night.notes}</p>{admin && <form action={deleteWarcraftNight}><input type="hidden" name="id" value={night.id} /><button className={styles.remove}>Remove recap</button></form>}</article>)}</div>}
    </section>

    {admin && <section className={`${styles.section} ${styles.editor}`}><p className={styles.eyebrow}>Party management · Admin</p><h2>Set the course.</h2><details><summary>Edit plans & characters</summary><form action={updateWarcraftHub} className={styles.form}>
      {([['nextNight', 'Next game night'], ['schedule', 'Weekly rhythm'], ['realm', 'Realm'], ['faction', 'Faction'], ['objective', 'Next-night goal']] as const).map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={hub[key]} required maxLength={1000} /></label>)}
      {hub.players.map((player, index) => <fieldset key={player.name}><legend>{player.name}</legend><label>Attendance<select name={`status-${index}`} defaultValue={player.status}><option>Confirmed</option><option>Maybe</option></select></label><label>Character<input name={`character-${index}`} defaultValue={player.character} maxLength={80} /></label><label>Class / choice<input name={`class-${index}`} defaultValue={player.className} maxLength={80} /></label><label>Level<input name={`level-${index}`} defaultValue={player.level} maxLength={20} /></label></fieldset>)}
      <button>Save party & plans</button>
    </form></details><details><summary>Add a game-night recap</summary><form action={addWarcraftNight} className={styles.form}><label>Game-night date<input name="date" type="date" required /></label><label>Chapter title<input name="title" placeholder="An excellent plan. A questionable pull." maxLength={150} required /></label><label>What happened?<textarea name="notes" rows={7} maxLength={6000} placeholder="Who played, where we went, what we finished, loot worth remembering, and where we pick up next time…" required /></label><button>Publish recap</button></form></details></section>}
    <footer className={styles.footnote}>Our unofficial group hub for World of Warcraft: Forever. Hero artwork © Blizzard Entertainment, from <a href="https://worldofwarcraft.blizzard.com/en-us/forever/" target="_blank" rel="noopener noreferrer">the official WoW Forever site ↗</a>. Adventure-log illustration created for Suwanee Gamers.</footer>
  </div>;
}
