"use client";

import { useActionState } from "react";
import type { WarcraftPlayer } from "@/lib/wowForever";
import { updateWarcraftCharacter, type CharacterSaveState } from "./actions";
import styles from "./warcraft.module.css";

export function CharacterEditor({ player }: { player: WarcraftPlayer }) {
  const [state, action, pending] = useActionState<CharacterSaveState, FormData>(updateWarcraftCharacter, {});
  return <details className={styles.characterEditor}>
    <summary>Edit character</summary>
    <form action={action} className={styles.form}>
      <input type="hidden" name="player" value={player.name} />
      <label>Character name<input name="character" defaultValue={player.character} maxLength={80} /></label>
      <label>Class / choice<input name="className" defaultValue={player.className} maxLength={80} /></label>
      <label>Level<input name="level" type="number" min={1} max={999} step={1} defaultValue={player.level} /></label>
      <label>Character image<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/avif" /><span className={styles.small}>PNG, JPG, WebP, or AVIF · up to 5 MB</span></label>
      {player.image && <label className={styles.removeImage}><input type="checkbox" name="removeImage" /> Remove current image</label>}
      <p role={state.error ? "alert" : "status"}>{state.error || state.success}</p>
      <button disabled={pending}>{pending ? "Saving…" : "Save character"}</button>
    </form>
  </details>;
}
