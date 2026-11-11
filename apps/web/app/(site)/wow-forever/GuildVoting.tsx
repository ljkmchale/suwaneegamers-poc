"use client";

import { useActionState } from "react";
import { nominateWarcraftGuild, voteWarcraftGuild, type GuildSaveState } from "./actions";
import styles from "./warcraft.module.css";

type Nomination = { id: string; name: string; nominatedBy: string; votes: number };
export function GuildVoting({ groupId, canVote, currentVote, nominations }: { groupId: string; canVote: boolean; currentVote?: string; nominations: Nomination[] }) {
  const [nomination, nominate, nominating] = useActionState<GuildSaveState, FormData>(nominateWarcraftGuild, {});
  const [vote, castVote, voting] = useActionState<GuildSaveState, FormData>(voteWarcraftGuild, {});
  return <div className={styles.guildVoting}>
    {canVote && <form action={nominate} className={styles.form}>
      <input type="hidden" name="groupId" value={groupId} />
      <label>Nominate a guild name<input name="guildName" required minLength={2} maxLength={80} placeholder="Your idea for our guild" /></label>
      <button disabled={nominating}>{nominating ? "Adding…" : "Nominate name"}</button>
      <p role={nomination.error ? "alert" : "status"}>{nomination.error || nomination.success}</p>
    </form>}
    {!canVote && <p>Members of this party can nominate names and vote.</p>}
    {nominations.length === 0 ? <p className={styles.guildEmpty}>No names nominated yet. Let’s find a name that feels like us.</p> : <ul className={styles.guildNames}>
      {nominations.map(item => <li key={item.id}>
        <div><h3>{item.name}</h3><p>Nominated by {item.nominatedBy}</p><p>{item.votes} {item.votes === 1 ? "vote" : "votes"}{currentVote === item.id ? " · Your choice" : ""}</p></div>
        {canVote && <form action={castVote}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="nominationId" value={item.id} /><button disabled={voting || currentVote === item.id} aria-pressed={currentVote === item.id}>{currentVote === item.id ? "Your vote" : "Vote for this name"}</button></form>}
      </li>)}
    </ul>}
    <p role={vote.error ? "alert" : "status"}>{vote.error || vote.success}</p>
  </div>;
}
