import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { AddToCartButton } from "@/components/store/AddToCartButton";
import { formatPrice, getActiveProduct, paypalPriceCents } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const product = getActiveProduct((await params).slug);
  return product
    ? { title: product.name, description: product.shortDescription }
    : { title: "Product not found" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const product = getActiveProduct((await params).slug);
  if (!product) notFound();
  const customerPriceCents = paypalPriceCents(product.priceCents);
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-24 pt-12">
      <Link href="/store" className="text-xs uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
        ← Back to the Gamers’ Forge
      </Link>
      <div className="mt-7 grid gap-9 lg:grid-cols-2">
        <div
          className="fantasy-card flex aspect-square items-center justify-center bg-cover bg-center"
          style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
        >
          {!product.imageUrl && <Package size={64} style={{ color: "var(--color-text-muted)" }} aria-hidden="true" />}
        </div>
        <section className="py-3">
          <p className="text-xs uppercase tracking-[.3em]" style={{ color: "var(--color-accent-arcane)" }}>
            {product.category.replace("-", " ")}
          </p>
          <h1 className="mt-3 font-cinzel text-3xl uppercase tracking-widest">{product.name}</h1>
          <p className="mt-4 text-xl" style={{ color: "var(--color-accent-gold)" }}>{formatPrice(customerPriceCents)}</p>
          <p className="mt-6 leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
            {product.description || product.shortDescription}
          </p>
          <div className="mt-8">
            <AddToCartButton product={{
              id: product.id, slug: product.slug, name: product.name,
              priceCents: customerPriceCents, imageUrl: product.imageUrl,
            }} />
          </div>
        </section>
      </div>
    </div>
  );
}
