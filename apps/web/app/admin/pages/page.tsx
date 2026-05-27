import Link from "next/link";
import { getAllCustomPages } from "@/lib/customPages";
import { archivePageAction, restorePageAction, deletePageAction } from "./actions";

export default function AdminPagesPage() {
  const pages = getAllCustomPages().filter((p) => p.status !== "deleted");

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-1">Pages</h1>
          <p className="text-sm text-[#a89880]">
            Create custom pages and fill them with blocks using the Edit Layout overlay.
          </p>
        </div>
        <Link
          href="/admin/pages/new"
          className="shrink-0 px-4 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors"
        >
          + New Page
        </Link>
      </div>

      {pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#2a2a35] p-12 text-center">
          <p className="font-cinzel text-sm tracking-widest uppercase text-[#5a5060] mb-3">No custom pages yet</p>
          <p className="text-sm text-[#5a5060] mb-6">
            Create a page, then visit it on the public site to add blocks with the Edit Layout overlay.
          </p>
          <Link href="/admin/pages/new"
            className="inline-block px-4 py-2 rounded font-cinzel text-xs tracking-widest uppercase border border-[#2a2a35] text-[#a89880] hover:border-[#8b5cf6] transition-colors">
            Create your first page
          </Link>
        </div>
      ) : (
        <div className="border border-[#2a2a35] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#16161e] text-[#5a5060] text-xs uppercase tracking-widest border-b border-[#2a2a35]">
                <th className="px-4 py-3 text-left">Title</th>
                <th className="px-4 py-3 text-left">URL</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-[#2a2a35] last:border-0 hover:bg-[#16161e]">
                  <td className="px-4 py-3 font-medium text-[#e8dfc8]">{page.title}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/${page.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#8b5cf6] hover:underline"
                    >
                      /{page.slug} ↗
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-cinzel tracking-widest uppercase px-2 py-0.5 rounded-full border"
                      style={{
                        color: page.status === "active" ? "var(--color-accent-arcane)" : "var(--color-text-muted)",
                        borderColor: page.status === "active" ? "var(--color-accent-arcane)" : "var(--color-bg-border)",
                      }}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5a5060] text-xs">{page.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      {page.status === "active" && (
                        <>
                          <a
                            href={`/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#a89880] hover:text-[#f59e0b] transition-colors"
                          >
                            View
                          </a>
                          <form action={archivePageAction.bind(null, page.id)}>
                            <button type="submit"
                              className="text-xs text-[#5a5060] hover:text-[#a89880] transition-colors">
                              Archive
                            </button>
                          </form>
                        </>
                      )}
                      {page.status === "archived" && (
                        <form action={restorePageAction.bind(null, page.id)}>
                          <button type="submit"
                            className="text-xs text-[#5a5060] hover:text-[#8b5cf6] transition-colors">
                            Restore
                          </button>
                        </form>
                      )}
                      <form
                        action={deletePageAction.bind(null, page.id)}
                        onSubmit={(e) => {
                          if (!confirm(`Permanently delete "${page.title}"?`)) e.preventDefault();
                        }}
                      >
                        <button type="submit"
                          className="text-xs text-[#5a5060] hover:text-[#ef4444] transition-colors">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Explain the workflow */}
      <div className="mt-8 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <p className="font-cinzel text-xs tracking-widest uppercase text-[#5a5060] mb-2">How it works</p>
        <ol className="text-sm text-[#a89880] space-y-1 list-decimal list-inside">
          <li>Create a page here — choose a title and URL slug.</li>
          <li>Visit the live page URL (as admin). The <strong className="text-[#e8dfc8]">Edit Layout</strong> button will appear.</li>
          <li>Open the overlay → <strong className="text-[#e8dfc8]">Assets</strong> tab → add blocks to build the page.</li>
          <li>Archive to hide from visitors without deleting; restore to make it live again.</li>
        </ol>
      </div>
    </div>
  );
}
