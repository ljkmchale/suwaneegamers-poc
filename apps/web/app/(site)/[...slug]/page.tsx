import { notFound } from "next/navigation";
import { getCustomPage } from "@/lib/customPages";
import { getPageLayout, getPageGrid } from "@/lib/pageLayouts";
import { PageBlockList } from "@/components/blocks/PageBlockList";

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

  // page.status === "active" — render live page
  const pageId = `/${slugStr}`;
  const items = getPageLayout(pageId);
  const grid = getPageGrid(pageId);
  const isCritTables = pageId === "/crit_tables";

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

  if (isCritTables) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black">
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          aria-hidden="true"
          style={{
            backgroundImage:
              'url("/media/images/guides-to-myrdae/reference-cards/dm-reference-background.webp")',
          }}
        />
        <div
          className="fixed inset-0 z-0"
          aria-hidden="true"
          style={{
            background:
              "linear-gradient(180deg, rgba(8,5,15,0.82) 0%, rgba(8,5,15,0.68) 42%, rgba(8,5,15,0.96) 100%), linear-gradient(90deg, rgba(8,5,15,0.76), rgba(34,18,11,0.48), rgba(8,5,15,0.78))",
          }}
        />
        <div className="relative z-10 pb-20 pt-8">
          <PageBlockList items={items} grid={grid} />
        </div>
      </div>
    );
  }

  return <PageBlockList items={items} grid={grid} />;
}
