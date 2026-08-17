import type { Metadata } from "next";
import { readContent } from "@/lib/contentFiles";
import { getCampaignJourneys } from "@/lib/campaignJourneys";
import { getGazetteerEntries } from "@/lib/gazetteer";
import { getOldPantheonDeities, getPantheonDeities } from "@/lib/pantheon";
import type { PageEntry } from "@/lib/brain/vector-store";
import { loadLibraryCatalog } from "@/lib/brain/library-catalog";
import { LibraryExperience, type LibraryBook } from "./LibraryExperience";

export const metadata: Metadata = {
  title: "Advents of Harmony — Knowledge & Lore",
  description: "Explore the collected campaigns, histories, gods, places, and lore of Myrdae.",
};

type CampaignRecord = {
  id: string;
  name: string;
  description?: string;
  headerImage?: string;
  dm?: string;
  sessionSummaries?: Array<{ title?: string; summary?: string }>;
};

function pages(...values: Array<string | null | undefined>): string[] {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

export default async function AdventsOfHarmonyPage() {
  const campaigns = readContent<CampaignRecord[]>("campaigns.json");
  const journeys = getCampaignJourneys();
  const [deities, oldGods, chroniclesBooks] = await Promise.all([getPantheonDeities(), getOldPantheonDeities(), getChroniclesBooks()]);
  const places = getGazetteerEntries();

  const campaignBooks: LibraryBook[] = campaigns.map((campaign, index) => {
    const journey = journeys.campaigns.find((item) => item.id === campaign.id);
    const recordedSessions = campaign.sessionSummaries ?? [];
    return {
      id: `campaign-${campaign.id}`,
      title: campaign.name,
      subtitle: `The campaign chronicles of ${campaign.dm ?? "Myrdae"}`,
      collection: "Campaign Chronicles",
      color: ["#6e2034", "#263d68", "#36563d", "#684b24", "#49356b"][index % 5],
      image: campaign.headerImage ?? "/media/images/guides-to-myrdae/campaign-setting.jpg",
      pages: pages(
        campaign.description,
        journey?.stops.length
          ? `This company has left ${journey.stops.length} recorded marks upon the map of Myrdae. Its path winds through ${journey.stops.map((stop) => stop.location).join(", ")}.`
          : "The route of this company has not yet been fully entered into the cartographers' ledger.",
        ...recordedSessions.flatMap((entry) => [entry.title, entry.summary]),
      ),
    };
  });

  const deityBooks: LibraryBook[] = deities.map((deity, index) => ({
    id: `deity-${deity.id}`,
    title: deity.name,
    subtitle: deity.title ?? "A divine record",
    collection: "The New Gods",
    color: ["#5b3f75", "#43366f", "#62405f", "#3d5570"][index % 4],
    image: deity.image ?? "/media/images/guides-to-myrdae/reference-cards/campaign-setting-faith-beliefs.webp",
    pages: pages(
      deity.domain ? `Domains: ${deity.domain}` : null,
      deity.details,
      "This volume is held in the New Order collection of the Grand Library.",
    ),
  }));

  const oldGodBooks: LibraryBook[] = oldGods.map((deity, index) => ({
    id: `old-deity-${deity.id}`,
    title: deity.name,
    subtitle: deity.domain ? `Old God of ${deity.domain}` : "The Assembly of Essence",
    collection: "The Old Gods",
    color: ["#203f50", "#384354", "#2e4250", "#453c54"][index % 4],
    image: "/media/images/guides-to-myrdae/reference-cards/campaign-setting-faith-beliefs.webp",
    pages: pages(
      deity.domain ? `Divine domain: ${deity.domain}` : null,
      deity.details,
      "This silent divinity is recorded among the eight members of the Assembly of Essence.",
    ),
  }));

  const placeBooks: LibraryBook[] = places.map((place, index) => ({
    id: `place-${place.id}`,
    title: place.title,
    subtitle: [place.size, place.region].filter(Boolean).join(" · ") || "A place in Myrdae",
    collection: "Atlas & Gazetteer",
    color: ["#6b4b25", "#35524c", "#594232"][index % 3],
    image: place.imageUrl ?? "/media/images/maps-of-myrdae/locations-map.webp",
    pages: pages(
      place.description,
      place.region ? `Filed by the royal cartographers under the region of ${place.region}.` : null,
      "Notes, maps, and eyewitness additions to this volume remain part of the living record of Myrdae.",
    ),
  }));

  const archiveBooks = [...chroniclesBooks.adventure, ...chroniclesBooks.world];
  const enrichedDeities = attachRelatedSources([...deityBooks, ...oldGodBooks], archiveBooks);
  const enrichedPlaces = attachRelatedSources(placeBooks, archiveBooks);
  const adventureBooks = uniqueBooks([...campaignBooks, ...chroniclesBooks.adventure]);
  const worldBooks = uniqueBooks([...enrichedDeities, ...enrichedPlaces, ...chroniclesBooks.world]);
  return <LibraryExperience books={[...adventureBooks, ...worldBooks]} />;
}

async function getChroniclesBooks(): Promise<{ adventure: LibraryBook[]; world: LibraryBook[] }> {
  try {
    const catalog = await loadLibraryCatalog();
    const playerPages = catalog.pages;

    const readablePages = playerPages.filter((page) => {
      const sourcePath = page.path.replaceAll("\\", "/");
      if (!sourcePath.startsWith("wiki/")) return false;
      return !/(source audit|source grounding|audit tracker|grounding standards|synthesis\.md$|\/sources\/)/i.test(`${page.title} ${sourcePath}`);
    });
    const worldCategories = /^(world|locations|items|entities|concepts|answers)$/;
    const worldPages = uniquePages(readablePages.filter((page) => {
      const categoryName = page.path.replaceAll("\\", "/").split("/")[1] ?? "";
      return page.campaign === "World" || worldCategories.test(categoryName);
    }));
    const worldPaths = new Set(worldPages.map((page) => page.path));
    const adventurePages = uniquePages(readablePages.filter((page) => !worldPaths.has(page.path)));

    return {
      adventure: adventurePages.map((page, index) => sourceBook(page, "Chronicles Archive", index)),
      world: worldPages.map((page, index) => sourceBook(page, "World Archive", index)),
    };
  } catch {
    return { adventure: [], world: [] };
  }
}

function uniqueBooks(books: LibraryBook[]): LibraryBook[] {
  return [...new Map(books.map((book) => [`${book.collection === "Chronicles Archive" || book.collection === "Campaign Chronicles" ? "adventure" : "world"}:${normalizeTitle(book.title)}`, book])).values()];
}

function attachRelatedSources(books: LibraryBook[], archiveBooks: LibraryBook[]): LibraryBook[] {
  return books.map((book) => {
    const needle = ` ${normalizeTitle(book.title)} `;
    const sourcePaths = archiveBooks
      .filter((archiveBook) => ` ${normalizeTitle(archiveBook.title)} `.includes(needle))
      .map((archiveBook) => archiveBook.sourcePath)
      .filter((sourcePath): sourcePath is string => Boolean(sourcePath));
    return sourcePaths.length ? { ...book, sourcePaths: [...new Set(sourcePaths)] } : book;
  });
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function uniquePages(pages: Array<Pick<PageEntry, "path" | "title" | "campaign" | "visibility">>): Array<Pick<PageEntry, "path" | "title" | "campaign" | "visibility">> {
  return [...new Map(pages.map((page) => [page.path, page])).values()];
}

function sourceBook(page: Pick<PageEntry, "path" | "title" | "campaign" | "visibility">, collection: string, index: number): LibraryBook {
  const category = page.path.replaceAll("\\", "/").split("/")[1] ?? "archive";
  return {
    id: `chronicles-${page.path}`,
    title: page.title.replace(/�/g, "—"),
    subtitle: `${page.campaign === "All" ? "Myrdae" : page.campaign} · ${category.replace(/(^|-)\w/g, (value) => value.toUpperCase())}`,
    collection,
    color: ["#603028", "#273e55", "#425037", "#574020", "#46345b"][index % 5],
    image: collection === "World Archive" ? "/media/images/maps-of-myrdae/locations-map.webp" : "/media/images/guides-to-myrdae/campaign-setting.jpg",
    pages: [],
    sourcePath: page.path,
  };
}
