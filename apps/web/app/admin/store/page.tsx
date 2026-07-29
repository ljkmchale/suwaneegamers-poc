import Link from "next/link";
import { createProductAction, updateProductAction, updateStorefrontVisibilityAction } from "./actions";
import { ensureStarterProductDrafts, formatPrice, isStorefrontEnabled, listAllProducts, paypalPriceCents, paypalStoreConfig } from "@/lib/store";

export const dynamic = "force-dynamic";

const fieldClass = "w-full rounded border border-[#2a2a35] bg-[#08050f] px-3 py-2 text-sm text-[#e8dfc8]";

export default function AdminStorePage() {
  ensureStarterProductDrafts();
  const products = listAllProducts();
  const storefrontEnabled = isStorefrontEnabled();
  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-cinzel text-3xl uppercase tracking-widest">Store</h1>
          <p className="mt-2 text-sm text-[#a89880]">Build the catalog now; enable checkout after business details and PayPal credentials are ready.</p>
        </div>
        <Link href="/store" target="_blank" className="rounded border border-[#2a2a35] px-4 py-2 text-xs uppercase tracking-wider text-[#f59e0b]">
          View store ↗
        </Link>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
          <p className="text-xs uppercase tracking-wider text-[#5a5060]">Catalog</p>
          <p className="mt-2 text-xl">{products.length} products</p>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
          <p className="text-xs uppercase tracking-wider text-[#5a5060]">PayPal</p>
          <p className="mt-2 text-sm text-[#a89880]">{paypalStoreConfig.configured ? `${paypalStoreConfig.environment} configured` : "Not configured"}</p>
          <p className="mt-1 text-xs text-[#5a5060]">Prices recover 3.49% + $0.49.</p>
        </div>
        <div className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
          <p className="text-xs uppercase tracking-wider text-[#5a5060]">Checkout</p>
          <p className="mt-2 text-sm text-[#a89880]">Safely disabled</p>
        </div>
      </div>

      <form action={updateStorefrontVisibilityAction} className="mt-6 flex items-center justify-between gap-5 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div>
          <h2 className="font-cinzel text-sm uppercase tracking-wider">Public storefront</h2>
          <p className="mt-1 text-xs text-[#a89880]">
            Controls the Store button in the production top menu and whether Myra offers Store navigation.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-3 text-xs uppercase tracking-wider text-[#a89880]">
          <input name="enabled" type="checkbox" defaultChecked={storefrontEnabled} className="h-5 w-5 accent-violet-500" />
          {storefrontEnabled ? "Visible" : "Hidden"}
        </label>
        <button className="rounded border border-[#8b5cf6] px-4 py-2 text-xs uppercase tracking-wider text-[#8b5cf6]">
          Save visibility
        </button>
      </form>

      <section className="mt-9">
        <h2 className="font-cinzel text-lg uppercase tracking-wider">Starter products</h2>
        <p className="mt-1 text-xs text-[#5a5060]">Drafts are invisible to visitors. Change status to Active only when the listing is ready.</p>
        <div className="mt-5 space-y-5">
          {products.map((product) => (
            <details key={product.id} className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
              <summary className="cursor-pointer px-5 py-4">
                <span className="font-cinzel uppercase tracking-wider">{product.name}</span>
                <span className="ml-3 rounded-full border border-[#2a2a35] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#8b5cf6]">{product.status}</span>
                <span className="float-right text-right text-sm text-[#f59e0b]">
                  {formatPrice(paypalPriceCents(product.priceCents))}
                  <small className="block text-[10px] text-[#5a5060]">Base {formatPrice(product.priceCents)}</small>
                </span>
              </summary>
              <form action={updateProductAction.bind(null, product.id)} className="grid gap-4 border-t border-[#2a2a35] p-5 md:grid-cols-2">
                <label className="text-xs text-[#a89880]">Name<input name="name" required defaultValue={product.name} className={`${fieldClass} mt-1`} /></label>
                <label className="text-xs text-[#a89880]">URL slug<input name="slug" defaultValue={product.slug} className={`${fieldClass} mt-1`} /></label>
                <label className="text-xs text-[#a89880]">Category
                  <select name="category" defaultValue={product.category} className={`${fieldClass} mt-1`}>
                    <option value="t-shirts">T-Shirts</option><option value="dice-boxes">Dice Boxes</option><option value="dice-bags">Dice Bags</option><option value="other">Other</option>
                  </select>
                </label>
                <label className="text-xs text-[#a89880]">
                  Base price (USD)
                  <input name="price" type="number" min="0" step="0.01" defaultValue={(product.priceCents / 100).toFixed(2)} className={`${fieldClass} mt-1`} />
                  <span className="mt-1 block text-[10px] text-[#5a5060]">
                    Customer price with PayPal fee: {formatPrice(paypalPriceCents(product.priceCents))}
                  </span>
                </label>
                <label className="text-xs text-[#a89880]">Inventory (blank means untracked)<input name="inventoryQuantity" type="number" min="0" defaultValue={product.inventoryQuantity ?? ""} className={`${fieldClass} mt-1`} /></label>
                <label className="text-xs text-[#a89880]">Status
                  <select name="status" defaultValue={product.status} className={`${fieldClass} mt-1`}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select>
                </label>
                <label className="text-xs text-[#a89880] md:col-span-2">Image URL<input name="imageUrl" defaultValue={product.imageUrl ?? ""} className={`${fieldClass} mt-1`} /></label>
                <label className="text-xs text-[#a89880] md:col-span-2">Short description<input name="shortDescription" defaultValue={product.shortDescription} className={`${fieldClass} mt-1`} /></label>
                <label className="text-xs text-[#a89880] md:col-span-2">Full description<textarea name="description" rows={5} defaultValue={product.description} className={`${fieldClass} mt-1`} /></label>
                <input type="hidden" name="fulfillmentType" value={product.fulfillmentType} />
                <div className="md:col-span-2"><button className="rounded bg-[#8b5cf6] px-4 py-2 text-xs uppercase tracking-wider text-white">Save product</button></div>
              </form>
            </details>
          ))}
        </div>
      </section>

      <details className="mt-8 rounded-lg border border-dashed border-[#2a2a35] p-5">
        <summary className="cursor-pointer font-cinzel text-sm uppercase tracking-wider text-[#a89880]">Add another draft product</summary>
        <form action={createProductAction} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs text-[#a89880]">Name<input name="name" required className={`${fieldClass} mt-1`} /></label>
          <label className="text-xs text-[#a89880]">Category<select name="category" className={`${fieldClass} mt-1`}><option value="t-shirts">T-Shirts</option><option value="dice-boxes">Dice Boxes</option><option value="dice-bags">Dice Bags</option><option value="other">Other</option></select></label>
          <input type="hidden" name="status" value="draft" /><input type="hidden" name="fulfillmentType" value="physical" />
          <div className="md:col-span-2"><button className="rounded border border-[#8b5cf6] px-4 py-2 text-xs uppercase tracking-wider text-[#8b5cf6]">Create draft</button></div>
        </form>
      </details>
    </div>
  );
}
