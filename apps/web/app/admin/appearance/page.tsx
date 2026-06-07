import { readContent } from "@/lib/contentFiles";
import { AppearanceEditor } from "./AppearanceEditor";
import type { Theme } from "@/lib/theme";

export default function AppearancePage() {
  const theme = readContent<Theme>("theme.json");

  return (
    <div>
      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">Appearance</h1>
      <p className="text-sm text-[#a89880] mb-8">
        Control every visual aspect of the site — colors, fonts, card styles, glow effects, and more.
        Changes take effect after saving and reloading the public site.
      </p>
      <AppearanceEditor initial={theme} />
    </div>
  );
}
