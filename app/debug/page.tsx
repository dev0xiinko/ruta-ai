import Link from "next/link";
import { Footer } from "@/components/ruta/footer";
import { Navbar } from "@/components/ruta/navbar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabaseAdmin } from "@/lib/supabase/client";
import type {
  RoutePlaceBindingRow,
  RouteStopRow,
  RouteVariantMapRefRow,
  RouteVariantRow,
  RouteVariantStopOrderRow,
} from "@/lib/ruta-engine/types";

export const dynamic = "force-dynamic";

type DebugPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    variant?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "0%";
  return `${Math.round(value * 100)}%`;
}

function confidenceTone(score: number | null | undefined) {
  if ((score ?? 0) >= 0.85) return "default" as const;
  if ((score ?? 0) >= 0.6) return "secondary" as const;
  return "outline" as const;
}

function jsonPreview(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function loadCount(table: string) {
  const { count, error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function loadVariantRows(codeFilter: string) {
  let query = supabaseAdmin
    .from("route_variants")
    .select("*")
    .order("route_code", { ascending: true })
    .order("confidence_score", { ascending: false })
    .limit(40);

  if (codeFilter) {
    query = query.ilike("route_code", `%${codeFilter}%`);
  }

  const { data, error } = await query.returns<RouteVariantRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadSelectedVariantDetails(variantId: string | null) {
  if (!variantId) {
    return {
      mapRefs: [] as RouteVariantMapRefRow[],
      stopOrder: [] as Array<RouteVariantStopOrderRow & { route_stops: RouteStopRow | null }>,
      bindings: [] as RoutePlaceBindingRow[],
    };
  }

  const [{ data: mapRefs, error: mapError }, { data: stopOrder, error: stopError }, { data: bindings, error: bindingError }] =
    await Promise.all([
      supabaseAdmin
        .from("route_variant_map_refs")
        .select("*")
        .eq("variant_id", variantId)
        .returns<RouteVariantMapRefRow[]>(),
      supabaseAdmin
        .from("route_variant_stop_order")
        .select("*, route_stops(*)")
        .eq("variant_id", variantId)
        .order("stop_order", { ascending: true })
        .returns<Array<RouteVariantStopOrderRow & { route_stops: RouteStopRow | null }>>(),
      supabaseAdmin
        .from("route_place_bindings")
        .select("*")
        .eq("variant_id", variantId)
        .order("order_hint", { ascending: true, nullsFirst: false })
        .order("match_confidence", { ascending: false })
        .returns<RoutePlaceBindingRow[]>(),
    ]);

  if (mapError) throw new Error(mapError.message);
  if (stopError) throw new Error(stopError.message);
  if (bindingError) throw new Error(bindingError.message);

  return {
    mapRefs: mapRefs ?? [],
    stopOrder: stopOrder ?? [],
    bindings: bindings ?? [],
  };
}

export default async function DebugPage({ searchParams }: DebugPageProps) {
  const params = (await searchParams) ?? {};
  const codeFilter = firstValue(params.code).trim();
  const selectedVariantKey = firstValue(params.variant).trim();

  const [variantCount, mapRefCount, stopCount, stopOrderCount, bindingCount, variants] = await Promise.all([
    loadCount("route_variants"),
    loadCount("route_variant_map_refs"),
    loadCount("route_stops"),
    loadCount("route_variant_stop_order"),
    loadCount("route_place_bindings"),
    loadVariantRows(codeFilter),
  ]);

  const selectedVariant =
    variants.find((variant) => variant.variant_key === selectedVariantKey) ?? variants[0] ?? null;

  const { mapRefs, stopOrder, bindings } = await loadSelectedVariantDetails(selectedVariant?.id ?? null);

  return (
    <main className="min-h-screen">
      <Navbar />

      <section className="px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Internal Debug
            </p>
            <h1 className="section-heading mt-4">Inspect route variants and deterministic routing data.</h1>
            <p className="section-copy mt-5">
              This page shows what the v2 engine is actually reading from Supabase: route variants,
              ordered stops, place bindings, and scraped map references. Use it to sanity-check a
              route before changing the matcher or bot output.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription>Variants</CardDescription>
                <CardTitle className="text-3xl">{variantCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription>Map refs</CardDescription>
                <CardTitle className="text-3xl">{mapRefCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription>Canonical stops</CardDescription>
                <CardTitle className="text-3xl">{stopCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription>Stop order rows</CardDescription>
                <CardTitle className="text-3xl">{stopOrderCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-white/5">
              <CardHeader className="pb-3">
                <CardDescription>Place bindings</CardDescription>
                <CardTitle className="text-3xl">{bindingCount}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle>Variant list</CardTitle>
                <CardDescription>
                  Filter by route code, then open one variant to inspect its stops, bindings, and map metadata.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <form action="/debug" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <input
                    type="text"
                    name="code"
                    defaultValue={codeFilter}
                    placeholder="Filter by route code, like 17B"
                    className="h-11 rounded-2xl border border-white/10 bg-background/70 px-4 text-sm text-foreground outline-none ring-0 transition-colors placeholder:text-muted-foreground focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Filter
                  </button>
                  <Link
                    href="/debug"
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-foreground transition-colors hover:bg-white/10"
                  >
                    Reset
                  </Link>
                </form>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => {
                      const isSelected = selectedVariant?.id === variant.id;
                      const href = `/debug?code=${encodeURIComponent(codeFilter || variant.route_code)}&variant=${encodeURIComponent(variant.variant_key)}`;

                      return (
                        <TableRow key={variant.id} className={isSelected ? "bg-white/5" : undefined}>
                          <TableCell className="font-semibold text-foreground">{variant.route_code}</TableCell>
                          <TableCell className="max-w-[360px] whitespace-normal">
                            <Link href={href} className="transition-colors hover:text-primary">
                              <span className="font-medium text-foreground">{variant.display_name}</span>
                              <span className="mt-1 block text-xs text-muted-foreground">{variant.variant_key}</span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{variant.direction ?? "unknown"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={confidenceTone(variant.confidence_score)}>
                              {formatPercent(variant.confidence_score)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {variants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          No variants matched that filter yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle>Selected variant</CardTitle>
                <CardDescription>
                  {selectedVariant
                    ? "This is the detail view the engine can now use for deterministic routing."
                    : "Pick a route variant from the list to inspect its internals."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedVariant ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{selectedVariant.route_code}</Badge>
                      <Badge variant="outline">{selectedVariant.qa_status}</Badge>
                      <Badge variant={confidenceTone(selectedVariant.confidence_score)}>
                        {formatPercent(selectedVariant.confidence_score)}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-foreground">{selectedVariant.display_name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedVariant.signboard ?? "No signboard recorded"} • {selectedVariant.variant_key}
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Stop order
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-foreground">{stopOrder.length}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-background/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Place bindings
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-foreground">{bindings.length}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Ordered stops
                      </h3>
                      <div className="space-y-2">
                        {stopOrder.length > 0 ? (
                          stopOrder.map((row) => (
                            <div
                              key={row.id}
                              className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-background/60 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {row.stop_order}. {row.route_stops?.display_name ?? row.raw_text ?? "Unknown stop"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {row.route_stops?.canonical_name ?? "No canonical stop"} • {row.source_section ?? "no source section"}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                {row.is_pickup ? <Badge variant="secondary">pickup</Badge> : null}
                                {row.is_dropoff ? <Badge variant="secondary">dropoff</Badge> : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
                            No ordered stops recorded for this variant yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Map refs
                      </h3>
                      {mapRefs.length > 0 ? (
                        mapRefs.map((mapRef) => (
                          <div
                            key={mapRef.id}
                            className="rounded-2xl border border-white/10 bg-background/60 p-4 text-sm"
                          >
                            <p className="font-semibold text-foreground">{mapRef.map_title ?? "Untitled map ref"}</p>
                            <div className="mt-3 space-y-2 text-muted-foreground">
                              <p>
                                <span className="text-foreground">Page:</span>{" "}
                                <a href={mapRef.page_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                                  open source page
                                </a>
                              </p>
                              {mapRef.google_map_url ? (
                                <p>
                                  <span className="text-foreground">Google map:</span>{" "}
                                  <a
                                    href={mapRef.google_map_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                  >
                                    open map
                                  </a>
                                </p>
                              ) : null}
                              <p>
                                <span className="text-foreground">Map ID:</span> {mapRef.map_id ?? "n/a"}
                              </p>
                              <p>
                                <span className="text-foreground">Center:</span> {mapRef.center_ll ?? "n/a"}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-background/40 px-4 py-5 text-sm text-muted-foreground">
                          No map references recorded for this variant.
                        </div>
                      )}
                    </div>

                    <details className="group rounded-2xl border border-white/10 bg-background/60">
                      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-foreground">
                        Place bindings ({bindings.length})
                      </summary>
                      <div className="space-y-2 border-t border-white/10 px-4 py-4">
                        {bindings.length > 0 ? (
                          bindings.map((binding) => (
                            <div
                              key={binding.id}
                              className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{binding.source_section ?? "unknown section"}</Badge>
                                {binding.order_hint != null ? (
                                  <Badge variant="secondary">order {binding.order_hint}</Badge>
                                ) : null}
                                {binding.needs_review ? <Badge variant="destructive">needs review</Badge> : null}
                              </div>
                              <p className="mt-3 text-sm font-medium text-foreground">{binding.raw_text}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                method: {binding.match_method} • confidence: {Math.round(binding.match_confidence * 100)}%
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                matched place ids: {binding.matched_place_ids.length > 0 ? binding.matched_place_ids.join(", ") : "none"}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No place bindings stored for this variant.</p>
                        )}
                      </div>
                    </details>

                    <details className="group rounded-2xl border border-white/10 bg-background/60">
                      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-foreground">
                        Raw summary JSON
                      </summary>
                      <pre className="overflow-x-auto border-t border-white/10 px-4 py-4 text-xs text-muted-foreground">
                        {jsonPreview(selectedVariant.raw_summary)}
                      </pre>
                    </details>
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                    No variant selected yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
