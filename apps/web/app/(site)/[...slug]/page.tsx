import { notFound } from "next/navigation";
import { getCustomPage } from "@/lib/customPages";
import { getPageLayout } from "@/lib/pageLayouts";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { BlockItem } from "@/lib/pageBlocks";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export default async function CustomPageRoute({ params }: Props) {
  const { slug } = await params;
  const slugStr = slug.join("/");
  const page = getCustomPage(slugStr);

  if (!page || page.status === "deleted") {
    notFound();
  }

  if (page.status === "archived") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <p className="font-cinzel text-sm tracking-widest uppercase text-[#5a5060] mb-2">Page Archived</p>
        <p className="text-[#a89880] text-sm max-w-sm">
          This page has been archived and is not currently available to visitors.
        </p>
      </div>
    );
  }

  // page.status === "active"
  const pageId = `/${slugStr}`;
  const items = getPageLayout(pageId);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-4 text-[#e8dfc8]">
          {page.title}
        </h1>
        <p className="text-[#5a5060] text-sm max-w-md">
          This page has no content yet. Visit it as an admin and use the{" "}
          <strong className="text-[#e8dfc8]">Edit Layout</strong> button to add blocks.
        </p>
      </div>
    );
  }

  return (
    <div>
      {items.map((item) => {
        if (item.kind === "section") return null; // custom pages have no built-in sections
        return <BlockRenderer key={item.id} block={item as BlockItem} />;
      })}
    </div>
  );
}
