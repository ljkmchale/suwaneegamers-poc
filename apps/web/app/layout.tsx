import type { Metadata } from "next";
import { Cinzel, Lora } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-cinzel",
  weight: ["400", "600", "700", "900"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Suwanee Gamers",
    default: "Suwanee Gamers — The World of Myrdae",
  },
  description:
    "Eight campaigns. Four Dungeon Masters. One living world. The official campaign portal for Suwanee Gamers — explore the world of Myrdae, track campaigns, and follow upcoming sessions.",
  openGraph: {
    title: "Suwanee Gamers",
    description: "The World of Myrdae — Year 1246 AF, The Awakening",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${lora.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
