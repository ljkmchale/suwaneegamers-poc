import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAdminSession } from "@/lib/adminSession";
import { getWarcraftHub, warcraftGroups, visibleWarcraftPlayers, type WarcraftPlayer } from "@/lib/wowForever";
import { addWarcraftNight, updateWarcraftHub, configureWarcraftGroup } from "./actions";
import styles from "./warcraft.module.css";
import { PartySwitcher, partyLabel } from "./PartySwitcher";
import { DungeonProgress } from "./DungeonProgress";
import { CharacterEditor } from "./CharacterEditor";
import { GuildVoting } from "./GuildVoting";
import { LandscapeBackdrop } from "./LandscapeBackdrop";
import { getUserSession } from "@/lib/userSession";
import { getWarcraftPlayerName, getWarcraftProfileId, selectWarcraftGroup } from "@/lib/warcraftInvitations";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { fetchUpcomingCalendarEvents } from "@/lib/calendar";
import { warcraftCalendarNights, warcraftNightDate, warcraftNightTime } from "@/lib/warcraftSchedule";

export const metadata: Metadata = { title: "WoW Forever", description: "Our weekly World of Warcraft: Forever adventures, party roster, plans, and game-night Chronicles." };

type IconKind = "swords" | "scroll" | "compass" | "shield" | "calendar" | "crystal";
const iconPositions: Record<IconKind, string> = {
  swords: "0% 0%", scroll: "50% 0%", compass: "100% 0%",
  shield: "0% 100%", calendar: "50% 100%", crystal: "100% 100%",
};

function PaintedIcon({ kind, size = 32 }: { kind: IconKind; size?: number }) {
  return <span aria-hidden="true" className={styles.paintedIcon} style={{ width: size, height: size, backgroundPosition: iconPositions[kind] }} />;
}

function PlayerPortrait({ player, own }: { player: WarcraftPlayer; own: boolean }) {
  const portrait = player.image
    ? <Image src={player.image} alt={`${player.name}'s character`} width={72} height={88} sizes="72px" className={styles.characterPortrait} />
    : <span className={styles.initial} aria-hidden="true">{player.name.slice(0, 1)}</span>;
  const href = player.armoryUrl || (own ? "https://timewalking.blizzard.com/" : undefined);
  const label = player.armoryUrl ? `View ${player.character || player.name} on Blizzard Armory` : "View my Blizzard stats";
  return href ? <a className={`${styles.playerTop} ${styles.statsPortrait}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} title={label}>{portrait}</a> : <div className={styles.playerTop}>{portrait}</div>;
}

export default async function WarcraftPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const stored = getWarcraftHub();
  const admin = (await getAdminSession()).isAdmin === true;
  const email = (await getUserSession()).email;
  const profileId = getWarcraftProfileId(email);
  const { available, group } = selectWarcraftGroup(warcraftGroups(stored), profileId, admin, (await searchParams).group);
  if (!group) notFound();
  const hub = { ...stored, objective: group.objective || stored.objective, players: visibleWarcraftPlayers(group.players), nights: group.nights };
  let calendarUnavailable = false;
  const upcoming = await fetchUpcomingCalendarEvents().then(events => warcraftCalendarNights(events)).catch(error => {
    console.error("[wow-forever] Calendar unavailable", error);
    calendarUnavailable = true;
    return [];
  });
  const nextNight = upcoming[0];
  const ownPlayer = getWarcraftPlayerName(email, group.id);
  const chroniclesUrl = admin || available.length > 1 ? `/wow-forever/chronicles?group=${encodeURIComponent(group.id)}` : "/wow-forever/chronicles";
  const profiles = admin ? getDb().prepare("SELECT id, email FROM user_profiles").all() as { id: string; email: string }[] : [];


  return <div className={styles.page}>
    <div className={styles.worldBackdrop} aria-hidden="true" />
    <div className={styles.worldVeil} aria-hidden="true" />
    <header className={styles.hero}>
      <div className={styles.heroArtwork}>
        <Image src="/media/images/wow-forever/blizzard-forever-key-art-v1.webp" alt="Blizzard’s World of Warcraft: Forever key art: adventurers overlooking Azeroth’s forests, towers, and mountains beneath a violet and golden sky." fill sizes="100vw" priority />
      </div>
      <div className={styles.heroContent}>
      <p className={styles.eyebrow}>Suwanee Gamers · Our PC game night</p>
      <h1 className={styles.logoTitle}><Image src="/media/images/wow-forever/blizzard-forever-logo.png" alt="World of Warcraft Forever" width={882} height={718} sizes="(max-width: 700px) 80vw, 440px" priority className={styles.foreverLogo} /></h1>
      {admin && <p className={styles.eyebrow}>{partyLabel(group, available.indexOf(group))}</p>}
      <PartySwitcher groups={available} selected={group.id} admin={admin} />
      <p className={styles.tagline}>Azeroth is better together.</p>
      <p className={styles.intro}>Our weekly adventure with familiar friends. Find the next game night, meet the crew, and follow our story.</p>
      <div className={styles.actions}>{group.discordUrl && <a href={group.discordUrl} target="_blank" rel="noopener noreferrer">Join us on Discord ↗</a>}<a href="#party">Meet the party <PaintedIcon kind="shield" size={28} /></a><Link href={chroniclesUrl}>Chronicles <PaintedIcon kind="scroll" /></Link></div>
      </div>
    </header>

    <div className={styles.planning} id="game-nights">
      <section className={styles.card} aria-labelledby="next-night-heading">
        <p className={styles.eyebrow}><PaintedIcon kind="calendar" /> Next game night</p>
        <h2 id="next-night-heading">{nextNight ? warcraftNightDate(nextNight) : calendarUnavailable ? "Check the calendar" : "More adventures ahead"}</h2>
        <p className={styles.nextNightTime}>{nextNight ? warcraftNightTime(nextNight) : calendarUnavailable ? "The schedule is temporarily unavailable." : "No WoW nights are listed in the next month."}</p>
        <p className={styles.small}>Game nights follow the Suwanee Gamers calendar.</p>
        {upcoming.length > 1 && <div className={styles.upcomingNights}><span>Coming up</span>{upcoming.slice(1, 4).map(event => <time key={`${event.uid}-${event.start}`} dateTime={event.start}>{warcraftNightDate(event)}<small>{warcraftNightTime(event)}</small></time>)}</div>}
        <div className={styles.actions}><Link href="/calendar">View the calendar ↗</Link>{group.discordUrl && <a href={group.discordUrl} target="_blank" rel="noopener noreferrer">Meet on Discord ↗</a>}</div>
      </section>
      <section className={`${styles.card} ${styles.realmCard}`} aria-label="Our corner of Azeroth">
        <p className={styles.eyebrow}><PaintedIcon kind="compass" /> Our corner of Azeroth</p>
        <dl className={styles.details}><div><dt>Realm</dt><dd>{hub.realm === "To be decided" ? "Realm selection in progress" : hub.realm}</dd></div><div><dt>Faction</dt><dd className={styles.factionValue}>{/^Alliance\b/i.test(hub.faction) && <Image src="/media/images/wow-forever/blizzard-alliance-logo.png" alt="" width={42} height={48} className={styles.factionEmblem} />}<span>{hub.faction}</span></dd></div><div><dt>The crew</dt><dd>{hub.players.length} adventurers</dd></div></dl>
        <div className={styles.objective}><PaintedIcon kind="crystal" /><p>{hub.objective}</p></div>
      </section>
    </div>

    <section id="party" className={styles.section}><p className={styles.eyebrow}><PaintedIcon kind="shield" /> The party roster</p><h2>Your adventuring party.</h2><p className={styles.subtitle}>The crew taking on Azeroth, one game night at a time.</p>
      <div className={styles.roster}>{hub.players.map(player => <article className={styles.player} key={player.name}><h3>{player.name}</h3><PlayerPortrait player={player} own={ownPlayer === player.name} /><dl className={styles.characterFacts}><div><dt>Name</dt><dd>{player.character || "To be decided"}</dd></div><div><dt>Race</dt><dd>{player.race || "To be decided"}</dd></div><div><dt>Class</dt><dd>{player.className || "Undecided"}</dd></div><div><dt>Specialization</dt><dd>{player.specialization || "To be decided"}</dd></div>
          <div><dt>Professions</dt><dd>{player.professionRanks?.trim() ? <ul className={styles.professionRanks}>{player.professionRanks.split(/\r?\n/).filter(line => line.trim()).map((line, index) => <li key={index}>{line}</li>)}</ul> : player.professions || "To be decided"}</dd></div><div><dt>Level</dt><dd>{player.level || "To be decided"}</dd></div></dl>{(admin || ownPlayer === player.name) && <CharacterEditor player={player} groupId={group.id} />}</article>)}</div>
    </section>

    <section id="dungeons" className={`${styles.section} ${styles.dungeonSection}`} aria-labelledby="dungeon-heading">
      <p className={styles.eyebrow}><PaintedIcon kind="swords" /> Dungeon progress</p>
      <h2 id="dungeon-heading">Adventures conquered.</h2>
      <p className={styles.subtitle}>Check off your completed dungeons. Admins can update checks for any player.</p>
      <DungeonProgress groupId={group.id} players={hub.players} completions={group.dungeonCompletions ?? {}} ownPlayer={ownPlayer} admin={admin} />
    </section>

    <section id="guild" className={`${styles.section} ${styles.guildSection}`} aria-labelledby="guild-heading">
      <p className={styles.eyebrow}><PaintedIcon kind="shield" /> Our future guild</p>
      <h2 id="guild-heading">Give our guild a name.</h2>
      <p className={styles.subtitle}>Nominate a name, then vote for your favorite. Each member gets one vote and can change it anytime.</p>
      <GuildVoting groupId={group.id} canVote={!!profileId && !!group.members[profileId]} currentVote={profileId ? group.guild?.votes[profileId] : undefined} nominations={(group.guild?.nominations ?? []).map(item => ({ id: item.id, name: item.name, nominatedBy: group.members[item.nominatedBy] || "A party member", votes: Object.entries(group.guild?.votes ?? {}).filter(([member, vote]) => !!group.members[member] && vote === item.id).length }))} />
    </section>

    <section id="chronicles" className={styles.chronicleEntrance}>
      <span id="journal" className={styles.legacyAnchor} aria-hidden="true" />
      <LandscapeBackdrop />
      <div className={styles.chronicleEntranceText}>
      <p className={styles.eyebrow}><PaintedIcon kind="scroll" /> Chronicles</p>
      <h2>The Azeroth Chronicles</h2>
      <p className={styles.subtitle}>The places we discover, the battles we share, and the stories we carry home.</p>
      <div className={styles.actions}><Link href={chroniclesUrl}>Open the Chronicles <PaintedIcon kind="scroll" /></Link></div>
      </div>
    </section>

    {admin && <section className={`${styles.section} ${styles.editor}`}><p className={styles.eyebrow}>Party management · Admin</p><h2>Set the course.</h2><details><summary>Edit game-night plans</summary><form action={updateWarcraftHub} className={styles.form}>
      <input type="hidden" name="groupId" value={group.id} /><p className={styles.small}>The current goal applies to this party. Realm and faction are shared. Game-night dates and times come from the calendar. Edit the World of Warcraft Forever events there.</p>
      {([['realm', 'Realm'], ['faction', 'Faction'], ['objective', 'Our current goal']] as const).map(([key, label]) => <label key={key}>{label}<input name={key} defaultValue={hub[key]} required maxLength={1000} /></label>)}
      <button>Save game-night plans</button>
    </form></details><details><summary>Add a Chronicles chapter</summary><form action={addWarcraftNight} className={styles.form}><input type="hidden" name="groupId" value={group.id} /><label>Game-night date<input name="date" type="date" required /></label><label>Chapter title<input name="title" placeholder="Our first steps into Azeroth" maxLength={150} required /></label><label>What happened?<textarea name="notes" rows={7} maxLength={6000} placeholder="Who played, where we went, what we finished, loot worth remembering, and where we pick up next time…" required /></label><button>Publish chapter</button></form></details></section>}
    {admin && <section className={`${styles.section} ${styles.editor}`}><h2>Manage Warcraft groups</h2><p>Members use their registered account email. One email | player name per line. Game-night plans above are shared by all groups.</p>{[...warcraftGroups(stored), undefined].map(option => <details key={option?.id ?? "new"}><summary>{option ? `Edit ${partyLabel(option, warcraftGroups(stored).findIndex(item => item.id === option.id))}` : "Add a group"}</summary><form action={configureWarcraftGroup} className={styles.form}>
      <input type="hidden" name="groupId" value={option?.id ?? ""} />
      <label>Internal group name<input name="name" defaultValue={option?.name} required maxLength={80} /></label>
      <label>Party name shown to members<input name="partyName" defaultValue={option?.partyName} maxLength={80} placeholder="Azeroth Adventurers" /><span className={styles.small}>Used only for members who belong to multiple parties. Give each party a distinct name.</span></label>
      <label>Discord channel URL<input type="url" name="discordUrl" defaultValue={option?.discordUrl} /></label>
      <label>Members (email | player name)<textarea name="members" rows={7} defaultValue={option ? Object.entries(option.members).map(([id, name]) => `${profiles.find(profile => profile.id === id)?.email ?? ""} | ${name}`).join("\n") : ""} /></label>
      <button>Save group</button>
    </form></details>)}</section>}
    <footer className={styles.footnote}>Our unofficial group hub for World of Warcraft: Forever. Hero artwork © Blizzard Entertainment, from <a href="https://worldofwarcraft.blizzard.com/en-us/forever/" target="_blank" rel="noopener noreferrer">the official WoW Forever site ↗</a>. Landscape footage and Alliance emblem © Blizzard Entertainment. Emblem from the official World of Warcraft races page. Dungeon art © Blizzard Entertainment, from the <a href="https://worldofwarcraft.blizzard.com/en-us/news/24301455" target="_blank" rel="noopener noreferrer">official Forever dungeon guide</a> and the in-game Encounter Journal. Location art © Blizzard Entertainment, from the in-game world map and the official WoW Forever Riverglades preview. Other illustrations created for Suwanee Gamers.</footer>
  </div>;
}
