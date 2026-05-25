import Link from "next/link";

interface FeaturedCampaignProps {
  campaign: {
    id: string;
    name: string;
    description?: string | null;
    setting?: string | null;
    _count: {
      gameSessions: number;
      characters: number;
      quests: number;
    };
  };
}

export function FeaturedCampaign({ campaign }: FeaturedCampaignProps) {
  return (
    <div className="fantasy-card p-8 md:p-12">
      <p
        className="font-cinzel text-xs tracking-[0.4em] uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}
      >
        Active Campaign
      </p>
      <h2
        className="font-cinzel text-3xl md:text-4xl mb-3 shimmer-text"
      >
        {campaign.name}
      </h2>
      {campaign.setting && (
        <p className="italic mb-4" style={{ color: "var(--color-accent-arcane)" }}>
          {campaign.setting}
        </p>
      )}
      {campaign.description && (
        <p className="text-lg leading-relaxed mb-8 max-w-2xl"
          style={{ color: "var(--color-text-secondary)" }}>
          {campaign.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: "Sessions", value: campaign._count.gameSessions },
          { label: "Players", value: campaign._count.characters },
          { label: "Active Quests", value: campaign._count.quests },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p
              className="font-cinzel text-3xl font-bold"
              style={{ color: "var(--color-accent-gold)" }}
            >
              {stat.value}
            </p>
            <p className="text-xs font-cinzel tracking-widest uppercase mt-1"
              style={{ color: "var(--color-text-muted)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link
          href={`/campaigns`}
          className="px-6 py-2.5 rounded-lg border font-cinzel text-sm tracking-widest uppercase transition-all hover:scale-105"
          style={{
            borderColor: "var(--color-accent-gold)",
            color: "var(--color-accent-gold)",
          }}
        >
          View Campaign
        </Link>
      </div>
    </div>
  );
}
