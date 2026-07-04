export const campaigns = {
  HoE: {
    code: "HoE",
    name: "Heroes of Emberstran",
    aliases: ["heroes of emberstran"]
  },
  SoD: {
    code: "SoD",
    name: "Souls of Destiny",
    aliases: ["souls of destiny"]
  },
  TSV: {
    code: "TSV",
    name: "The Silent Vanguard",
    aliases: ["the silent vanguard", "silent vanguard"]
  },
  WB: {
    code: "WB",
    name: "Bloody Endeavor",
    aliases: ["bloody endeavor", "wyrm bane"]
  },
  D3: {
    code: "D3",
    name: "Dungeons III",
    aliases: ["dungeons iii", "dungeons 3", "d3"]
  }
};

export function campaignLine() {
  return Object.values(campaigns)
    .map((campaign) => `${campaign.code} (${campaign.name})`)
    .join(", ");
}

export function resolveCampaignAcronym(value) {
  const normalized = String(value).trim().toLowerCase();
  return Object.values(campaigns).find((campaign) => {
    return campaign.code.toLowerCase() === normalized || campaign.aliases.includes(normalized);
  });
}
