import Image from "next/image";
import Link from "next/link";
import type { WarcraftNight } from "@/lib/wowForever";
import { deleteWarcraftNight } from "./actions";
import styles from "./warcraft.module.css";

export function WarcraftChronicles({ nights, admin, standalone = false }: { nights: WarcraftNight[]; admin: boolean; standalone?: boolean }) {
  const chapters = [...nights].sort((a, b) => a.date.localeCompare(b.date));
  const Title = standalone ? "h1" : "h3";
  return <div className={styles.chronicleBook}>
    <aside className={styles.chronicleRail}>
      {standalone && <Link href="/wow-forever" className={styles.chronicleBack}>← Back to game night</Link>}
      <p className={styles.eyebrow}>World of Warcraft · Forever</p>
      <Title>The Azeroth Chronicles</Title>
      <p className={styles.chronicleRailIntro}>The story of our party, one game night at a time.</p>
      <nav aria-label="Warcraft chronicle chapters">
        <a href="#chronicles-opening" className={styles.chronicleOpeningLink}>The beginning</a>
        {chapters.length > 0 ? <ol className={styles.chapterIndex}>{chapters.map((chapter, index) => <li key={chapter.id}><a href={`#chapter-${chapter.id}`}><span>{String(index + 1).padStart(2, "0")}</span><span>{chapter.title}</span></a></li>)}</ol> : <p className={styles.chronicleUnwritten}>Chapter I awaits our first game night.</p>}
      </nav>
      <p className={styles.chronicleRailFoot}>{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"} recorded</p>
    </aside>
    <div className={styles.chroniclePages}>
      <header id="chronicles-opening" className={styles.chronicleCover}>
        <Image src="/media/images/wow-forever/azeroth-painted-road-v2.webp" alt="A painted Azeroth-inspired road leads past a warmly lit inn toward a mountain lake and distant towers." fill sizes="(max-width: 700px) 100vw, 850px" />
        <div className={styles.chronicleCoverText}><p className={styles.eyebrow}>The Azeroth Chronicles</p><h3>Every adventure<br />begins together.</h3><p>New characters. Familiar friends. Our story in Azeroth.</p>{chapters.length > 0 && <a href={`#chapter-${chapters[0].id}`}>Begin reading →</a>}</div>
      </header>
      {chapters.length === 0 ? <div className={styles.chroniclePreface}><p className={styles.eyebrow}>An unwritten chronicle</p><h3>The first chapter is still ahead.</h3><p>Our party is gathering. After our first game night, this is where the story begins: the places we explore, the challenges we overcome, and the moments we’ll remember.</p><p>Until then, the road to Azeroth awaits.</p></div> : chapters.map((chapter, index) => <article id={`chapter-${chapter.id}`} className={styles.chronicleChapter} key={chapter.id}>
        <header className={styles.chapterHeading}><p className={styles.eyebrow}>The Azeroth Chronicles · Chapter {index + 1}</p><h3>{chapter.title}</h3><time dateTime={chapter.date}>{new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${chapter.date}T12:00:00Z`))}</time></header>
        <div className={styles.chapterProse}>{chapter.notes.trim().split(/\n\s*\n/).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}</div>
        <nav aria-label={`Chapter ${index + 1} navigation`} className={styles.chapterNavigation}>{index > 0 && <a href={`#chapter-${chapters[index - 1].id}`}>← Previous chapter</a>}<a href="#chronicles-opening">Back to the beginning</a>{index < chapters.length - 1 && <a href={`#chapter-${chapters[index + 1].id}`}>Next chapter →</a>}</nav>
        {admin && <form action={deleteWarcraftNight} className={styles.chapterAdmin}><input type="hidden" name="id" value={chapter.id} /><button className={styles.remove}>Remove chapter</button></form>}
      </article>)}
    </div>
  </div>;
}
