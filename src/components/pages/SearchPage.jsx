import React, { useState, useEffect } from "react";
import { Search, X, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE = (import.meta.env.VITE_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");

const POPULAR_KEYWORDS = [
    "Matte Lipstick",
    "Red Shades",
    "Hydrating",
    "Long Lasting",
    "Nude Colors",
    "Glossy Finish",
    "Vegan",
    "Cruelty Free"
];

/* ---------- Asset resolvers (images) ---------- */
const IMG = import.meta.glob("/src/assets/images/**/*", {
    eager: true,
    query: "?url",
    import: "default",
});
const FALLBACK_IMAGE =
    IMG["/src/assets/images/product1.png"] ||
    Object.values(IMG)[0] ||
    "";
function resolveAsset(pth = "") {
    if (!pth) return "";
    let clean = String(pth).split("?")[0].split("#")[0].trim();
    if (clean.startsWith("/assets/")) clean = "/src" + clean;
    if (!clean.includes("/assets/images/")) clean = "/src/assets/images/" + clean.replace(/^\/+/, "");
    if (IMG[clean]) return IMG[clean];
    const fname = clean.split("/").pop();
    const kv = Object.entries(IMG).find(([k]) => k.endsWith("/" + fname));
    if (kv) return kv[1];
    return FALLBACK_IMAGE || pth;
}

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(Boolean(API_BASE));

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!API_BASE) {
                setLoadingCatalog(false);
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/products`);
                if (!res.ok) throw new Error("Failed to load catalog");
                const payload = await res.json();
                if (cancelled) return;
                const items = Array.isArray(payload) ? payload : payload?.data;
                if (Array.isArray(items)) setCatalog(items);
            } catch (err) {
                console.error(err);
            } finally {
                if (!cancelled) setLoadingCatalog(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    // Debounced search simulation (client-side filter of API products)
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(() => {
            const q = query.toLowerCase();
            const filtered = catalog.filter((p) => {
                const haystack = [
                    p.name,
                    p.description?.headline,
                    p.description?.body,
                    ...(Array.isArray(p.tags) ? p.tags : []),
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(q);
            });
            setResults(filtered);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div className="min-h-screen bg-[var(--accent)] text-[var(--primary)]">
            <div className="mx-auto max-w-4xl px-4 py-8 md:py-16">

                {/* Search Input Section */}
                <div className="relative mb-12">
                    <div className="relative flex items-center border-b-2 border-[var(--border)] focus-within:border-[var(--primary)] transition-colors duration-300">
                        <Search className="h-6 w-6 text-[var(--muted-foreground)]" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for products, shades, or collections..."
                            className="w-full bg-transparent px-4 py-4 text-xl md:text-2xl font-medium placeholder:text-[var(--muted-foreground)] focus:outline-none text-[var(--primary)]"
                            autoFocus
                        />
                        {query && (
                            <button
                                onClick={() => setQuery("")}
                                className="p-2 hover:bg-[var(--secondary-100)] rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-[var(--muted-foreground)]" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                {!query ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Popular Keywords */}
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                                <TrendingUp className="h-4 w-4" />
                                Popular Searches
                            </div>
                            <div className="flex flex-wrap gap-3">
                {POPULAR_KEYWORDS.map((keyword) => (
                    <button
                        key={keyword}
                        onClick={() => setQuery(keyword)}
                        className="rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition-all hover:border-[var(--secondary-300)] hover:bg-[var(--secondary-100)] hover:shadow-sm active:scale-95"
                                    >
                                        {keyword}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Recent/Suggested Categories (Static for demo) */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="group relative overflow-hidden rounded-2xl bg-[var(--secondary-100)] aspect-[2/1] md:aspect-auto">
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    <h3 className="text-lg font-bold text-[var(--primary)]">New Arrivals</h3>
                                    <p className="text-sm text-[var(--muted-foreground)] mb-2">Check out the latest drops</p>
                                    <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider underline decoration-transparent group-hover:decoration-current transition-all text-[var(--primary)]">
                                        Shop Now <ArrowRight className="ml-1 h-3 w-3" />
                                    </span>
                                </div>
                            </div>
                            <div className="group relative overflow-hidden rounded-2xl bg-[var(--secondary-100)] aspect-[2/1] md:aspect-auto">
                                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                                    <h3 className="text-lg font-bold text-[var(--primary)]">Best Sellers</h3>
                                    <p className="text-sm text-[var(--muted-foreground)] mb-2">Everyone's favorites</p>
                                    <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider underline decoration-transparent group-hover:decoration-current transition-all text-[var(--primary)]">
                                        Shop Now <ArrowRight className="ml-1 h-3 w-3" />
                                    </span>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <h2 className="text-sm font-medium text-[var(--muted-foreground)]">
                            {isSearching || loadingCatalog
                                ? "Searching..."
                                : `Found ${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`}
                        </h2>

                        {results.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((product) => (
                                    <Link
                                        key={product.id}
                                        to={`/product/${product.slug || product.id}`}
                                        className="group block space-y-3"
                                    >
                                        <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--secondary-100)]">
                                            {/* Primary Image */}
                                            <img
                                                src={resolveAsset(
                                                    product.media?.gallery?.[0]?.url ||
                                                    product.media?.gallery?.[0]?.id ||
                                                    product.media?.heroImage
                                                )}
                                                alt={product.name}
                                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            {/* Secondary Image (Hover) */}
                                            {product.media?.gallery?.[1] && (
                                                <img
                                                    src={resolveAsset(product.media.gallery[1].url || product.media.gallery[1].id)}
                                                    alt={`${product.name} alternate`}
                                                    className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                                                />
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[var(--primary)] group-hover:underline decoration-1 underline-offset-4">
                                                {product.name}
                                            </h3>
                                            <p className="text-sm text-[var(--muted-foreground)]">
                                                {product.pricing?.currency || product.currency || "INR"}{" "}
                                                {product.pricing?.price ?? product.price ?? product.basePrice ?? 0}
                                            </p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            !isSearching && (
                                <div className="text-center py-12">
                                    <p className="text-[var(--muted-foreground)]">No results found. Try checking your spelling or use different keywords.</p>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
