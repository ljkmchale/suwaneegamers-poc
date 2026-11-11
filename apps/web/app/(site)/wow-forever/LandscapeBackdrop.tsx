"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./warcraft.module.css";

const POSTER = "/media/images/wow-forever/zephras-landscape-poster.webp";
const VIDEO = "/media/images/wow-forever/zephras-landscape.mp4";

export function LandscapeBackdrop() {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [manualMotion, setManualMotion] = useState(false);
  const canAnimate = motionAllowed || manualMotion;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const update = () => setMotionAllowed(!preference.matches && !connection?.saveData);
    update();
    preference.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting) setLoad(true);
    });
    if (container.current) observer.observe(container.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (load && visible && canAnimate && !paused && !failed) {
      element.play().catch(() => setFailed(true));
    } else element.pause();
  }, [load, visible, canAnimate, paused, failed]);

  return <><div ref={container} className={styles.landscapeBackdrop}>
    <video ref={video} className={styles.landscapeVideo} poster={POSTER}
      src={load && canAnimate && !failed ? VIDEO : undefined}
      muted loop playsInline preload="none" aria-hidden="true" onError={() => setFailed(true)} />
    </div>
    {!failed && <button type="button" className={styles.landscapeToggle}
      onClick={() => {
        if (!canAnimate) { setManualMotion(true); setPaused(false); }
        else setPaused(value => !value);
      }} aria-pressed={canAnimate && !paused}>
      {!canAnimate || paused ? "Play landscape" : "Pause landscape"}
    </button>}
  </>;
}
