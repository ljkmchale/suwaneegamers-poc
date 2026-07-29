import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Box, Package, ShieldCheck, Shirt, ShoppingBag, Sparkles, Truck } from "lucide-react";
import { ConceptProductCard } from "@/components/store/ConceptProductCard";
import { formatPrice, getProductBySlug, listActiveProducts, paypalPriceCents } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "The Gamers’ Forge",
  description: "Official Suwanee Gamers shirts, dice boxes, and dice bags.",
};

const CATEGORIES = [
  {
    id: "t-shirts",
    label: "Apparel",
    description: "Wear the mark of your gaming fellowship.",
    icon: Shirt,
    accent: "#d97706",
    image: "/media/images/store/category-shirts.webp",
  },
  {
    id: "dice-boxes",
    label: "Dice Boxes",
    description: "Handcrafted protection for your treasured dice.",
    icon: Box,
    accent: "#a78bfa",
    image: "/media/images/store/category-dice-boxes.webp",
  },
  {
    id: "dice-bags",
    label: "Dice Bags",
    description: "Carry your hoard from table to table.",
    icon: Package,
    accent: "#be123c",
    image: "/media/images/store/category-dice-bags.webp",
  },
];

const CONCEPT_PRODUCTS = [
  {
    category: "Apparel/T-Shirt",
    slug: "suwanee-gamers-t-shirt",
    name: "Classic Dragon Crest Tee",
    description: "Soft gaming-night apparel featuring the full Suwanee Gamers dragon crest.",
    image: "/media/images/store/suwanee-gamers-shirts-v2.webp",
    colors: ["#111114", "#35343a", "#dfd3bc"],
    variants: [
      { label: "Black", color: "#111114", image: "/media/images/store/suwanee-gamers-shirts-v2.webp" },
      { label: "Charcoal", color: "#35343a", image: "/media/images/store/suwanee-gamers-tshirt-charcoal.webp" },
      { label: "Warm Cream", color: "#dfd3bc", image: "/media/images/store/suwanee-gamers-tshirt-cream.webp" },
    ],
    sampleShipping: "$5.95 shipping",
    anchorId: "t-shirts",
  },
  {
    category: "Apparel/Sweatshirt",
    slug: "suwanee-gamers-crewneck-sweatshirt",
    name: "Dragon Crest Crewneck",
    description: "A heavyweight crewneck sweatshirt with a small Suwanee Gamers crest on the front-left chest.",
    image: "/media/images/store/suwanee-gamers-crewneck-sweatshirt.webp",
    colors: ["#111114", "#35343a"],
    variants: [
      { label: "Black", color: "#111114", image: "/media/images/store/suwanee-gamers-crewneck-sweatshirt.webp" },
      { label: "Charcoal", color: "#35343a", image: "/media/images/store/suwanee-gamers-crewneck-charcoal.webp" },
    ],
    sampleShipping: "$8.95 shipping",
  },
  {
    category: "Apparel/Hoodie",
    slug: "suwanee-gamers-pullover-hoodie",
    name: "Dragon Crest Hoodie",
    description: "A heavyweight pullover hoodie with a small Suwanee Gamers crest on the front-left chest.",
    image: "/media/images/store/suwanee-gamers-pullover-hoodie.webp",
    colors: ["#111114", "#35343a"],
    variants: [
      { label: "Black", color: "#111114", image: "/media/images/store/suwanee-gamers-pullover-hoodie.webp" },
      { label: "Charcoal", color: "#35343a", image: "/media/images/store/suwanee-gamers-hoodie-charcoal.webp" },
    ],
    sampleShipping: "$8.95 shipping",
  },
  {
    category: "Dice Boxes",
    slug: "suwanee-gamers-dice-box",
    name: "Dragon Vault Dice Box",
    description: "A fitted seven-die vault in walnut or maple with a laser-engraved Suwanee Gamers mark.",
    image: "/media/images/store/dragon-vault-dice-box-walnut-v2.webp",
    colors: ["#5b321e", "#d2ad76"],
    variants: [
      { label: "Walnut", color: "#5b321e", image: "/media/images/store/dragon-vault-dice-box-walnut-v2.webp" },
      { label: "Maple", color: "#d2ad76", image: "/media/images/store/dragon-vault-dice-box-maple-v2.webp" },
    ],
    sampleShipping: "$8.95 shipping",
    anchorId: "dice-boxes",
  },
  {
    category: "Dice Boxes",
    slug: "suwanee-gamers-long-maple-dice-box",
    name: "Long Maple Dice Vault",
    description: "A slim, two-piece magnetic dice vault offered in purpleheart, walnut, or maple with an engraved Suwanee Gamers crest.",
    image: "/media/images/store/long-dice-box-maple-forge.webp",
    colors: ["#6d294e", "#5b321e", "#d2ad76"],
    variants: [
      { label: "Maple", color: "#d2ad76", image: "/media/images/store/long-dice-box-maple-forge.webp" },
      { label: "Walnut", color: "#5b321e", image: "/media/images/store/long-dice-box-walnut-forge.webp" },
      { label: "Purpleheart", color: "#6d294e", image: "/media/images/store/long-dice-box-purpleheart-forge.webp" },
    ],
    sampleShipping: "$8.95 shipping",
  },
  {
    category: "Dice Bags",
    slug: "suwanee-gamers-dice-bag",
    name: "Embroidered Hoard Bag",
    description: "Velvet or canvas dice storage with leather trim and an embroidered crest.",
    image: "/media/images/store/suwanee-gamers-dice-bags.webp",
    colors: ["#591226", "#19191d"],
    variants: [
      { label: "Burgundy", color: "#591226", image: "/media/images/store/suwanee-gamers-dice-bags-burgundy.webp" },
      { label: "Charcoal", color: "#19191d", image: "/media/images/store/suwanee-gamers-dice-bags-charcoal.webp" },
    ],
    sampleShipping: "$5.95 shipping",
    anchorId: "dice-bags",
  },
];

export default function StorePage() {
  const activeProducts = listActiveProducts();
  const conceptProducts = CONCEPT_PRODUCTS.map((concept) => ({
    ...concept,
    product: getProductBySlug(concept.slug),
  }));

  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <section className="relative min-h-[38rem] border-b" style={{ borderColor: "var(--color-bg-border)" }}>
        <Image
          src="/media/images/store/store-hero-shirts-v3.webp"
          alt="Front and back views of the Suwanee Gamers T-shirt"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,5,15,.98)_0%,rgba(8,5,15,.82)_38%,rgba(8,5,15,.18)_76%),linear-gradient(0deg,rgba(8,5,15,.95),transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[38rem] max-w-7xl items-center px-5 py-20">
          <div className="max-w-xl">
            <div className="mb-6 flex items-center gap-4">
              <Image src="/media/images/store/logo-original.png" alt="" width={76} height={76} className="h-16 w-auto object-contain" />
              <p className="font-cinzel text-xs uppercase tracking-[.38em]" style={{ color: "var(--color-accent-gold)" }}>
                Official Suwanee Gamers Gear
              </p>
            </div>
            <h1 className="font-cinzel text-5xl uppercase leading-[1.08] tracking-widest text-[#f5ead4] sm:text-6xl">
              Gear up for your next adventure
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-[#c9bda8]">
              Apparel and tabletop accessories created for the Suwanee Gamers community.
              The first collection is being forged now.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#featured" className="rounded-lg bg-[#d97706] px-6 py-3 font-cinzel text-xs uppercase tracking-widest text-white transition-colors hover:bg-[#f59e0b]">
                Preview the collection
              </a>
              <Link href="/store/cart" className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-black/25 px-5 py-3 font-cinzel text-xs uppercase tracking-widest text-[#e8dfc8] backdrop-blur-sm">
                <ShoppingBag size={16} aria-hidden="true" /> Your bag
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-[#0b0712]/90" style={{ borderColor: "var(--color-bg-border)" }}>
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-6 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "Made for gamers", copy: "Designed around the table, not generic merch." },
            { icon: ShieldCheck, title: "Community approved", copy: "Nothing launches until the group is happy with it." },
            { icon: Truck, title: "Pickup & shipping", copy: "Fulfillment options will be announced before launch." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex items-center gap-4">
              <Icon size={22} style={{ color: "var(--color-accent-gold)" }} aria-hidden="true" />
              <div><p className="font-cinzel text-xs uppercase tracking-wider">{title}</p><p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{copy}</p></div>
            </div>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-5">
        <section className="py-16">
          <div className="flex items-end justify-between gap-5">
            <div>
              <p className="font-cinzel text-xs uppercase tracking-[.35em]" style={{ color: "var(--color-accent-arcane)" }}>Shop by collection</p>
              <h2 className="mt-2 font-cinzel text-3xl uppercase tracking-widest">Choose your gear</h2>
            </div>
            <p className="hidden max-w-sm text-right text-sm md:block" style={{ color: "var(--color-text-secondary)" }}>
              Apparel and tabletop essentials made for every adventurer.
            </p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {CATEGORIES.map(({ id, label, description, icon: Icon, accent, image }) => (
              <a
                key={id}
                href={`#${id}`}
                className="group relative isolate min-h-72 overflow-hidden rounded-xl border p-6 transition-transform hover:-translate-y-1"
                style={{ borderColor: "var(--color-bg-border)" }}
              >
                <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <Icon size={22} className="mb-4" style={{ color: accent }} aria-hidden="true" />
                  <h3 className="font-cinzel text-xl uppercase tracking-wider text-white">{label}</h3>
                  <p className="mt-1 text-sm text-stone-300">{description}</p>
                  <span className="mt-4 inline-block text-[10px] uppercase tracking-[.24em]" style={{ color: accent }}>
                    Explore collection →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="featured" className="scroll-mt-24 border-t py-16" style={{ borderColor: "var(--color-bg-border)" }}>
          <div className="text-center">
            <p className="font-cinzel text-xs uppercase tracking-[.35em]" style={{ color: "var(--color-accent-arcane)" }}>First-look collection</p>
            <h2 className="mt-2 font-cinzel text-3xl uppercase tracking-widest">Coming to the Forge</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm" style={{ color: "var(--color-text-secondary)" }}>
              These are concept previews. Final products, colors, materials, and pricing may change before launch.
            </p>
          </div>

          <div className="mt-10 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
            {conceptProducts.map((product) => (
              <ConceptProductCard
                key={product.name}
                anchorId={"anchorId" in product ? product.anchorId : undefined}
                category={product.category}
                name={product.name}
                description={product.description}
                image={product.image}
                colors={product.colors}
                variants={"variants" in product ? product.variants : undefined}
                priceLabel={
                  product.product && product.product.priceCents > 0
                    ? formatPrice(paypalPriceCents(product.product.priceCents))
                    : "Not set"
                }
                sampleShipping={product.sampleShipping}
              />
            ))}
          </div>

          {activeProducts.length > 0 && (
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeProducts.map((product) => (
                <Link key={product.id} href={`/store/${product.slug}`} className="fantasy-card p-5">
                  <h3 className="font-cinzel uppercase tracking-wider">{product.name}</h3>
                  <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>{product.shortDescription}</p>
                  <p className="mt-4" style={{ color: "var(--color-accent-gold)" }}>{formatPrice(paypalPriceCents(product.priceCents))}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-2xl border px-7 py-12 sm:px-12" style={{ borderColor: "rgba(139,92,246,.32)", background: "radial-gradient(circle at top,rgba(139,92,246,.17),rgba(15,10,26,.96) 58%)" }}>
          <Image src="/media/images/store/logo-no-banner.webp" alt="" width={140} height={100} className="mx-auto h-24 w-auto object-contain opacity-90" />
          <h2 className="mt-5 text-center font-cinzel text-2xl uppercase tracking-widest">The forge is warming up</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Here is a sample of the choices we are considering. These details are provisional and can change before launch.
          </p>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {[
              {
                eyebrow: "T-Shirt options",
                title: "Classic Dragon Crest",
                lines: ["Sizes: S through 4XL", "Black, charcoal, or warm cream", "Front crest print", "Soft cotton-blend concept"],
              },
              {
                eyebrow: "Dice box options",
                title: "Dragon Vault",
                lines: ["Dark walnut concept", "Seven-die fitted storage", "Laser-engraved crest", "Magnetic or hinged closure"],
              },
              {
                eyebrow: "Dice bag options",
                title: "Embroidered Hoard",
                lines: ["Velvet or canvas", "Burgundy or charcoal", "Leather-trim concept", "Room for several dice sets"],
              },
            ].map((sample) => (
              <article key={sample.title} className="rounded-xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[.25em]" style={{ color: "var(--color-accent-arcane)" }}>{sample.eyebrow}</p>
                <h3 className="mt-2 font-cinzel text-sm uppercase tracking-wider">{sample.title}</h3>
                <ul className="mt-4 space-y-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {sample.lines.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span style={{ color: "var(--color-accent-gold)" }}>◆</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-[10px] uppercase tracking-[.2em]" style={{ color: "var(--color-text-muted)" }}>
            <span className="rounded-full border border-white/10 px-3 py-1.5">Local pickup: Free</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5">Standard shipping: $5.95–$8.95</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5">Free shipping over $75</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5">Sample pricing—not final</span>
          </div>
        </section>
      </main>
    </div>
  );
}
