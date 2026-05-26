import { readContent } from "@/lib/contentFiles";
import { AppearanceEditor } from "./AppearanceEditor";

interface Theme {
  colors: Record<string, string>;
  fonts: { heading: string; body: string };
  siteName?: string;
  siteTagline?: string;
}

export default function AppearancePage() {
  const theme = readContent<Theme>("theme.json");

  return (
    <div>
      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">Appearance</h1>
      <p className="text-sm text-[#a89880] mb-10">
        Change colors, fonts, and site identity. Changes take effect after saving and reloading the public site.
      </p>
      <AppearanceEditor initial={theme} />
    </div>
  );
}
