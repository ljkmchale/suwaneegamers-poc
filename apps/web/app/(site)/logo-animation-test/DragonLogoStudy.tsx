"use client";

import Image from "next/image";
import { useState } from "react";

const ASSET_ROOT = "/media/images/logo-animation";

export function DragonLogoStudy() {
  const [paused, setPaused] = useState(false);

  return (
    <section className="dragon-study" aria-label="Dragon-only logo animation study">
      <div className="separated-assets">
        <article className="asset-preview">
          <h2>Complete dragon layer</h2>
          <div className="asset-preview-frame">
            <Image
              src={`${ASSET_ROOT}/full-dragon-layer.png`}
              alt="Complete reconstructed dragon on a transparent background"
              fill
              sizes="(max-width: 760px) 92vw, 520px"
              priority
              unoptimized
            />
          </div>
        </article>

        <article className="asset-preview">
          <h2>Complete shield layer</h2>
          <div className="asset-preview-frame">
            <Image
              src={`${ASSET_ROOT}/complete-shield-layer.png`}
              alt="Complete reconstructed Suwanee Gamers shield without the dragon"
              fill
              sizes="(max-width: 760px) 92vw, 520px"
              loading="eager"
              unoptimized
            />
          </div>
        </article>
      </div>

      <h2 className="composite-heading">Animated composite</h2>
      <div className={`dragon-stage motion-enabled${paused ? " is-paused" : ""}`}>
        <Image
          className="dragon-layer dragon-complete"
          src={`${ASSET_ROOT}/full-dragon-layer.png`}
          alt=""
          fill
          sizes="(max-width: 768px) 92vw, 688px"
          priority
          unoptimized
          aria-hidden="true"
        />
        <Image
          className="dragon-layer shield-complete"
          src={`${ASSET_ROOT}/complete-shield-layer.png`}
          alt="Complete Suwanee Gamers shield with an independently animated dragon behind it"
          fill
          sizes="(max-width: 768px) 92vw, 688px"
          loading="eager"
          unoptimized
        />
      </div>

      <button
        type="button"
        className="dragon-pause"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? "Resume animation" : "Pause animation"}
      </button>
    </section>
  );
}
