import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAdminSession } from "@/lib/adminSession";
import { getWarcraftHub, warcraftGroups } from "@/lib/wowForever";
import { addWarcraftNight, updateWarcraftHub, configureWarcraftGroup } from "./actions";
import styles from "./warcraft.module.css";
import { CharacterEditor } from "./CharacterEditor";
import { getUserSession } from "@/lib/userSession";
import { getWarcraftPlayerName, getWarcraftProfileId, selectWarcraftGroup } from "@/lib/warcraftInvitations";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { formatWarcraftDate, isWarcraftDate } from "@/lib/warcraftDates";

export const metadata: Metadata = { title: "WoW Forever", description: "Our weekly World of Warcraft: Forever adventures, party roster, plans, and game-night Chronicles." };

type IconKind = "swords" | "scroll" | "compass" | "shield" | "calendar" | "crystal";
const iconPositions: Record<IconKind, string> = {
  swords: "0% 0%", scroll: "50% 0%", compass: "100% 0%",
  shield: "0% 100%", calendar: "50% 100%", crystal: "100% 100%",
};

function PaintedIcon({ kind, size = 32 }: { kind: IconKind; size?: number }) {
  return <span aria-hidden="true" className={styles.paintedIcon} style={{ width: size, height: size, backgroundPosition: iconPositions[kind] }} />;
}

export default async function WarcraftPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const stored = getWarcraftHub();
  const admin = (await getAdminSession()).isAdmin === true;
  const email = (await getUserSession()).email;
  const { available, group } = selectWarcraftGroup(warcraftGroups(stored), getWarcraftProfileId(email), admin, (await searchParams).group);
  if (!group) notFound();
  const hub = { ...stored, players: group.players, nights: group.nights };
  const ownPlayer = getWarcraftPlayerName(email, group.id);
  const chroniclesUrl = `/wow-forever/chronicles?group=${encodeURIComponent(group.id)}`;
  const profiles = admin ? getDb().prepare("SELECT id, email FROM user_profiles").all() as { id: string; email: string }[] : [];


  return <div className={styles.page}>
    <div className={styles.worldBackdrop} aria-hidden="true" />
    <div className={styles.worldVeil} aria-hidden="true" />
    <header className={styles.hero}>
      <div className={styles.heroArtwork}>
        <Image src="/media/images/wow-forever/blizzard-forever-key-art-v1.webp" alt="Blizzard’s World of Warcraft: Forever key art: adventurers overlooking Azeroth’s forests, towers, and mountains beneath a violet and golden sky." fill sizes="100vw" priority />
      </div>
      <div className={styles.heroContent}>
      <div className={styles.sigil}><PaintedIcon kind="swords" size={112} /></div>
      <p className={styles.eyebrow}>Suwanee Gamers · Our PC game night</p>
      <h1>World of Warcraft<span>Forever</span></h1>
      <p className={styles.eyebrow}>{group.name}</p>
      {available.length > 1 && <nav aria-label="Your Warcraft groups" className={styles.actions}>{available.map(option => <Link key={option.id} href={`/wow-forever?group=${encodeURIComponent(option.id)}`} aria-current={option.id === group.id ? "page" : undefined}>{option.name}</Link>)}</nav>}
      <p className={styles.tagline}>New characters. Familiar friends. A whole world of trouble.</p>
      <p className={styles.intro}>Our own little corner of Azeroth. Gather the party, make a plan, and keep the stories from every game night here.</p>
      <div className={styles.actions}>{group.discordUrl && <a href={group.discordUrl} target="_blank" rel="noopener noreferrer">Join us on Discord ↗</a>}<a href="#party">Meet the party <PaintedIcon kind="shield" size={28} /></a><Link href={chroniclesUrl}>Chronicles <PaintedIcon kind="scroll" /></Link></div>
      </div>
      <div className={styles.stats}><span><strong>{hub.players.length}</strong> adventurers</span><span><strong>Weekly</strong> give or take real life</span><span><strong>{hub.nights.length}</strong> chapters in the Chronicles</span></div>
    </header>

    <div className={styles.planning}>
      <section className={styles.card}><p className={styles.eyebrow}><PaintedIcon kind="calendar" /> Next time we log in</p><h2>{formatWarcraftDate(hub.nextNight)}</h2><p>{hub.schedule}</p><div className={styles.objective}><PaintedIcon kind="crystal" /><p>{hub.objective}</p></div></section>
      <section className={styles.card}><p className={styles.eyebrow}><PaintedIcon kind="compass" /> Our corner of Azeroth</p><dl className={styles.details}><div><dt>Realm</dt><dd>{hub.realm}</dd></div><div><dt>Faction</dt><dd>{hub.faction}</dd></div></dl><p className={styles.small}>One party, one shared adventure. We’ll fill in the details as the crew decides.</p></section>
    </div>

    <section id="party" className={styles.section}><p className={styles.eyebrow}><PaintedIcon kind="shield" /> The party roster</p><h2>Good company. Great adventures.</h2><p className={styles.subtitle}>The crew taking on Azeroth, one game night at a time.</p>
      <div className={styles.roster}>{hub.players.map(player => <article className={styles.player} key={player.name}><div className={styles.playerTop}>{player.image && <Image src={player.image} alt={`${player.name}'s character`} width={384} height={384} className={styles.characterPortrait} />}<span className={styles.initial} aria-hidden="true">{player.name.slice(0, 1)}</span></div><h3>{player.name}</h3><p className={styles.className}>{player.className}</p><p>{player.character || "Character name to come"}</p><p className={styles.small}>{player.level ? `Level ${player.level}` : "Adventure starts here"}</p>{(admin || ownPlayer === player.name) && <CharacterEditor player={player} groupId={group.id} />}</article>)}</div>
    </section>

    <section id="chronicles" className={styles.chronicleEntrance}>
      <span id="journal" className={styles.legacyAnchor} aria-hidden="true" />
      <Image src="/media/images/wow-forever/azeroth-painted-road-v2.webp" alt="A painted Azeroth-inspired road leads past an inn toward a mountain lake and distant towers." fill sizes="100vw" />
      <div className={styles.chronicleEntranceText}>
      <p className={styles.eyebrow}><PaintedIcon kind="scroll" /> Chronicles</p>
      <h2>The Azeroth Chronicles</h2>
      <p className={styles.subtitle}>The places we discover, the battles we share, and the stories we carry home.</p>
      <div className={styles.actions}><Link href={chroniclesUrl}>Open the Chronicles <PaintedIcon kind="scroll" /></Link></div>
      </div>
    </section>

    {admin && <section className={`${styles.section} ${styles.editor}`}><p className={styles.eyebrow}>Party management · Admin</p><h2>Set the course.</h2><details><summary>Edit game-night plans</summary><form action={updateWarcraftHub} className={styles.form}>
      <label>Next game night<input name="nextNight" type="date" defaultValue={isWarcraftDate(hub.nextNight) ? hub.nextNight : ""} style={{ colorScheme: "dark" }} /><span className={styles.small}>Choose a date, or leave blank until the next night is decided.</span></label>
      {([['schedule', 'Weekly rhythm'], ['realm', 'Realm'], ['faction', 'Faction'], ['objective', 'Next-night goal']] as const).map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={hub[key]} required maxLength={1000} /></label>)}
      <button>Save game-night plans</button>
    </form></details><details><summary>Add a Chronicles chapter</summary><form action={addWarcraftNight} className={styles.form}><input type="hidden" name="groupId" value={group.id} /><label>Game-night date<input name="date" type="date" required /></label><label>Chapter title<input name="title" placeholder="Our first steps into Azeroth" maxLength={150} required /></label><label>What happened?<textarea name="notes" rows={7} maxLength={6000} placeholder="Who played, where we went, what we finished, loot worth remembering, and where we pick up next time…" required /></label><button>Publish chapter</button></form></details></section>}
    {admin && <section className={`${styles.section} ${styles.editor}`}><h2>Manage Warcraft groups</h2><p>Members use their registered account email. One email | player name per line. Game-night plans above are shared by all groups.</p>{[...warcraftGroups(stored), undefined].map(option => <details key={option?.id ?? "new"}><summary>{option ? `Edit ${option.name}` : "Add a group"}</summary><form action={configureWarcraftGroup} className={styles.form}>
      <input type="hidden" name="groupId" value={option?.id ?? ""} />
      <label>Group name<input name="name" defaultValue={option?.name} required maxLength={80} /></label>
      <label>Discord channel URL<input type="url" name="discordUrl" defaultValue={option?.discordUrl} /></label>
      <label>Members (email | player name)<textarea name="members" rows={7} defaultValue={option ? Object.entries(option.members).map(([id, name]) => `${profiles.find(profile => profile.id === id)?.email ?? ""} | ${name}`).join("\n") : ""} /></label>
      <button>Save group</button>
    </form></details>)}</section>}
    <footer className={styles.footnote}>Our unofficial group hub for World of Warcraft: Forever. Hero artwork © Blizzard Entertainment, from <a href="https://worldofwarcraft.blizzard.com/en-us/forever/" target="_blank" rel="noopener noreferrer">the official WoW Forever site ↗</a>. Chronicles illustration created for Suwanee Gamers.</footer>
  </div>;
}
