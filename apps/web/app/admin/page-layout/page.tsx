import { getNavConfig } from "@/lib/nav";
import { PageLayoutEditor } from "./PageLayoutEditor";

export default function PageLayoutPage() {
  const config = getNavConfig();

  return (
    <div>
      <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-2">
        Navigation Layout
      </h1>
      <p className="text-sm text-[#a89880] mb-10">
        Drag items within each section to reorder them. The order here is
        reflected live in the public navigation after saving.
      </p>

      <PageLayoutEditor initial={config.sections} />
    </div>
  );
}
