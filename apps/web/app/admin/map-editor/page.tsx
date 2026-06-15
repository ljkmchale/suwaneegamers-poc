import type { Metadata } from "next";

const MAP_EDITOR_URL = "https://mapeditor.suwaneegamers.net/";

export const metadata: Metadata = {
  title: "Map Editor",
};

export default function AdminMapEditorPage() {
  return (
    <div className="flex h-screen min-h-0 flex-col bg-[#08050f]">
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#2a2a35] bg-[#0f0a1a] px-5 py-3">
        <div>
          <h1 className="font-cinzel text-xl tracking-widest uppercase">
            Map Editor
          </h1>
          <p className="text-sm text-[#a89880]">
            Hosted Myrdae map editor embedded in the admin toolset.
          </p>
        </div>

        <a
          href={MAP_EDITOR_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-[#2a2a35] px-3 py-2 font-cinzel text-[10px] tracking-widest uppercase text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]"
        >
          Open Full Page
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-[#0f0a1a]">
        <iframe
          title="Suwanee Gamers Map Editor"
          src={MAP_EDITOR_URL}
          className="h-full w-full border-0 bg-[#08050f]"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
