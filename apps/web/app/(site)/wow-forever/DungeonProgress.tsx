"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { WarcraftPlayer } from "@/lib/wowForever";
import { warcraftDungeons } from "@/lib/warcraftDungeons";
import { updateWarcraftDungeon, type CharacterSaveState } from "./actions";
import styles from "./warcraft.module.css";

function DungeonCheck({ groupId, player, dungeonId, dungeonName, completed }: { groupId: string; player: string; dungeonId: string; dungeonName: string; completed: boolean }) {
  const [state, action, pending] = useActionState<CharacterSaveState, FormData>(updateWarcraftDungeon, {});
  return <form action={action}>
    <input type="hidden" name="groupId" value={groupId} />
    <input type="hidden" name="player" value={player} />
    <input type="hidden" name="dungeonId" value={dungeonId} />
    <input type="hidden" name="completed" value={String(!completed)} />
    <button type="submit" role="checkbox" aria-checked={completed} aria-label={`${player} — ${dungeonName}`} disabled={pending} className={styles.dungeonCheck}>{pending ? "…" : completed ? "✓" : "—"}</button>
    {state.error && <p role="alert">{state.error}</p>}
    <span className={styles.dungeonStatus} role="status">{state.success}</span>
  </form>;
}

export function DungeonProgress({ groupId, players, completions, ownPlayer, admin }: { groupId: string; players: WarcraftPlayer[]; completions: Record<string, string[]>; ownPlayer?: string; admin: boolean }) {
  return <div className={styles.dungeonFrame}>
    <div className={styles.dungeonScroll} role="region" aria-label="Party dungeon progress" tabIndex={0}>
      <table className={styles.dungeonTable}>
        <caption className={styles.dungeonStatus}>Dungeon completions for this party</caption>
        <thead>
          <tr>
            <th scope="col">Dungeon</th>
            <th scope="col">Level</th>
            <th scope="col">Location</th>
            {players.map(player => <th scope="col" key={player.name}>{player.name}</th>)}
          </tr>
        </thead>
        <tbody>{warcraftDungeons.map(dungeon => {
          const completedPlayers = completions[dungeon.id] ?? [];
          const cleared = players.length > 0 && players.every(player => completedPlayers.includes(player.name));
          const locationImage = dungeon.location.toLowerCase().replaceAll("'", "").replaceAll(" ", "-");
          const comingLater = dungeon.status === "New · Coming later";
          return <tr key={dungeon.id} data-cleared={cleared} data-coming-later={comingLater}>
            <th scope="row" className={styles.dungeonNameCell}>
              <span className={styles.dungeonArtwork} aria-hidden="true">
                <Image src={`/media/images/wow-forever/dungeons/${dungeon.id}.webp`} alt="" fill sizes="(max-width: 600px) 136px, 232px" />
              </span>
              <span className={styles.dungeonName}>
                {dungeon.name}
                {dungeon.status && <span className={styles.dungeonRelease}>{dungeon.status}</span>}
              </span>
            </th>
            <td><span className={styles.dungeonLevel}>{dungeon.level}</span></td>
            <td className={styles.dungeonLocationCell}>
              <span className={styles.dungeonArtwork} aria-hidden="true">
                <Image src={`/media/images/wow-forever/locations/${locationImage}.webp`} alt="" fill sizes="(max-width: 600px) 128px, 180px" />
              </span>
              <span className={styles.dungeonName}>{dungeon.location}</span>
            </td>
            {players.map(player => {
              const completed = completedPlayers.includes(player.name);
              return <td key={player.name}>{admin || ownPlayer === player.name
                ? <DungeonCheck groupId={groupId} player={player.name} dungeonId={dungeon.id} dungeonName={dungeon.name} completed={completed} />
                : <span className={styles.dungeonMark} data-completed={completed} role="img" aria-label={completed ? "Completed" : "Completion not recorded"}>{completed ? "✓" : "—"}</span>}</td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className={styles.dungeonLegend}><span><strong aria-hidden="true">✓</strong> Completed</span><span><span aria-hidden="true">—</span> Unrecorded</span></p>
  </div>;
}
