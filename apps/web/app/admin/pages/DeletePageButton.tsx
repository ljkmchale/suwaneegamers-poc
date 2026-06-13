"use client";

import { deletePageAction } from "./actions";

export function DeletePageButton({ pageId, pageTitle }: { pageId: string; pageTitle: string }) {
  return (
    <form
      action={deletePageAction.bind(null, pageId)}
      onSubmit={(e) => {
        if (!confirm(`Permanently delete "${pageTitle}"?`)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="text-xs text-[#5a5060] hover:text-[#ef4444] transition-colors"
      >
        Delete
      </button>
    </form>
  );
}
