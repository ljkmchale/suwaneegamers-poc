import type { Metadata } from "next";
import { DragonLogoStudy } from "./DragonLogoStudy";
import "./study.css";

export const metadata: Metadata = {
  title: "Dragon Logo Animation Study | Suwanee Gamers",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LogoAnimationTestPage() {
  return (
    <main className="logo-study-page">
      <header className="logo-study-heading">
        <p className="logo-study-kicker">Private visual study</p>
        <h1>Dragon-Only Animation Test</h1>
        <p>
          Inspect both complete separated assets first, followed by the animated
          composite with the dragon behind the stationary shield.
        </p>
      </header>

      <DragonLogoStudy />
    </main>
  );
}
