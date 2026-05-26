"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderCampaignsAction } from "./actions";

interface CampaignRow {
  id: string;
  name: string;
  dm: string;
  schedule: string;
  official?: boolean;
}

function SortableRow({ campaign }: { campaign: CampaignRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: campaign.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-[#2a2a35] hover:bg-[#16161e]">
      <td className="px-3 py-3 cursor-grab text-[#5a5060] select-none" {...attributes} {...listeners}>
        ⠿
      </td>
      <td className="px-3 py-3 font-medium">{campaign.name}</td>
      <td className="px-3 py-3 text-[#a89880] text-sm">{campaign.dm}</td>
      <td className="px-3 py-3 text-[#a89880] text-sm">{campaign.schedule}</td>
      <td className="px-3 py-3 text-sm">
        {campaign.official === false
          ? <span className="text-[#5a5060]">Side</span>
          : <span className="text-[#8b5cf6]">Official</span>}
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/admin/campaigns/${campaign.id}`}
          className="text-xs text-[#f59e0b] hover:underline"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}

export function SortableCampaignList({ initial }: { initial: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState(initial);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = campaigns.findIndex((c) => c.id === active.id);
    const newIndex = campaigns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(campaigns, oldIndex, newIndex);
    setCampaigns(reordered);

    setSaving(true);
    await reorderCampaignsAction(reordered.map((c) => c.id));
    setSaving(false);
  }

  return (
    <div>
      {saving && (
        <p className="text-xs text-[#8b5cf6] mb-2">Saving order…</p>
      )}
      <table className="w-full text-sm border border-[#2a2a35] rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-[#16161e] text-[#5a5060] text-xs uppercase tracking-widest">
            <th className="px-3 py-2 text-left w-8" />
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">DM</th>
            <th className="px-3 py-2 text-left">Schedule</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left" />
          </tr>
        </thead>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={campaigns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {campaigns.map((c) => <SortableRow key={c.id} campaign={c} />)}
            </tbody>
          </SortableContext>
        </DndContext>
      </table>
    </div>
  );
}
