import { useRef, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { API_BASE } from "../utils";

export function BulkProductTools({ request, refresh }) {
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [jsonText, setJsonText] = useState("");

  const parseItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (payload && typeof payload === "object") return [payload]; // allow single product object
    throw new Error("Provide products as an array or { items: [...] }.");
  };

  const safeParseJson = (raw) => {
    // Remove BOM/zero-width chars, normalize smart quotes, trim whitespace
    const normalizeQuotes = (text) =>
      text.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
    const stripInvisible = (text) =>
      text
        // remove zero-width/BOM
        .replace(/[\u200B-\u200D\u2060-\u2064\uFEFF]/g, "")
        // replace non-breaking spaces with normal spaces
        .replace(/\u00A0/g, " ")
        // remove other control chars except \n, \r, \t
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    const clean = stripInvisible(normalizeQuotes(raw)).trim();

    const attempt = (text) => {
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: false, err };
      }
    };
    const attemptLenient = (text) => {
      try {
        // eslint-disable-next-line no-new-func
        const val = Function(`"use strict"; return (${text});`)();
        return { ok: true, data: val };
      } catch (err) {
        return { ok: false, err };
      }
    };

    const direct = attempt(clean);
    if (direct.ok) return direct.data;

    const extractBalancedJson = (text) => {
      const start = text.search(/[{\[]/);
      if (start < 0) return null;
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = -1;
      for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === "\\") {
          escape = true;
          continue;
        }
        if (ch === '"' && !escape) {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        if (ch === "{" || ch === "[") depth += 1;
        if (ch === "}" || ch === "]") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (depth === 0 && end >= start) {
        return text.slice(start, end + 1).trim();
      }
      return null;
    };

    const balanced = extractBalancedJson(clean);
    if (balanced) {
      const parsed = attempt(balanced);
      if (parsed.ok) return parsed.data;
      const parsedLenient = attemptLenient(balanced);
      if (parsedLenient.ok) return parsedLenient.data;
    }

    const lines = clean.split(/\r?\n/);
    const startLine = lines.findIndex((line) => line.trim().startsWith("{") || line.trim().startsWith("["));
    if (startLine >= 0) {
      const joined = lines.slice(startLine).join("\n").trim();
      const lineParse = attempt(joined);
      if (lineParse.ok) return lineParse.data;
      const lineParseLenient = attemptLenient(joined);
      if (lineParseLenient.ok) return lineParseLenient.data;
    }

    // 4) NDJSON (one JSON object per line) – only if all lines parse
    const nonEmptyLines = lines.filter((l) => l.trim());
    if (nonEmptyLines.length > 1) {
      const parsedLines = [];
      let ndjsonValid = true;
      for (const line of nonEmptyLines) {
        const parsed = attempt(line.trim());
        if (!parsed.ok) {
          ndjsonValid = false;
          break;
        }
        parsedLines.push(parsed.data);
      }
      if (ndjsonValid) {
        return parsedLines;
      }
    }

    const finalLenient = attemptLenient(clean);
    if (finalLenient.ok) return finalLenient.data;

    throw new Error("Invalid JSON: remove surrounding logs or fix JSON syntax.");
  };

  const importItems = async (items) => {
    const response = await request(`${API_BASE}/products/bulk-import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || "Bulk import failed");
    }
    const result = await response.json();
    setSummary(result);
    toast.success(`Imported ${result.created} created / ${result.updated} updated`);
    refresh?.();
  };

  const handleImportFile = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a JSON file first.");
      return;
    }
    try {
      setError("");
      setImporting(true);
      const text = await file.text();
      const items = parseItems(safeParseJson(text));
      await importItems(items);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to import file");
      toast.error(err.message || "Unable to import file");
    } finally {
      setImporting(false);
    }
  };

  const handleImportText = async () => {
    if (!jsonText.trim()) {
      toast.error("Paste JSON before importing.");
      return;
    }
    try {
      setError("");
      setImporting(true);
      const parsed = safeParseJson(jsonText);
      const items = parseItems(parsed);
      await importItems(items);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to import JSON");
      toast.error(err.message || "Unable to import JSON");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await request(`${API_BASE}/products/export`, {
        method: "GET",
      });
      if (!response.ok) {
        const body = await response.text().catch(() => null);
        throw new Error(body || "Export failed");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-export-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Unable to export products");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Bulk import</CardTitle>
          <CardDescription>Upload a JSON file or paste JSON to create/update products.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-products">JSON file</Label>
              <Input
                id="bulk-products"
                type="file"
                accept="application/json"
                ref={fileInputRef}
                disabled={importing}
              />
              <Button onClick={handleImportFile} disabled={importing} className="rounded-full w-full">
                {importing ? "Importing..." : "Import file"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-products-text">Paste JSON</Label>
              <textarea
                id="bulk-products-text"
                className="min-h-[120px] w-full rounded-xl border border-border/60 bg-muted/10 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder='[{ "name": "Lipstick", "slug": "lipstick", "basePrice": 999, "shades": [{ "name": "Red", "hexColor": "#ff0000", "quantity": 10 }] }]'
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                disabled={importing}
              />
              <Button onClick={handleImportText} disabled={importing} className="rounded-full w-full">
                {importing ? "Importing..." : "Import pasted JSON"}
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <p>Required per product: name, slug, basePrice.</p>
            <p>Optional: description, collectionId, images (url), shades (name, hexColor, sku, price, quantity).</p>
            <p>Supports product story/experience: hero, theme, gallery, badges, benefits, ingredientsHighlight, howToUse, claims, faqs, shipping, returns, pricing, reviewsList.</p>
          </div>
          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          {summary ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <p>
                Created: <span className="font-semibold text-primary">{summary.created}</span>
              </p>
              <p>
                Updated: <span className="font-semibold text-primary">{summary.updated}</span>
              </p>
              <p>
                Failed: <span className="font-semibold text-destructive">{summary.failed}</span>
              </p>
              {summary.results?.length ? (
                <ScrollArea className="mt-2 h-28 rounded-xl border border-border/60 bg-white px-3 py-2">
                  <ul className="space-y-1 text-xs">
                    {summary.results.map((result, index) => (
                      <li key={`${result.slug}-${index}`}>
                        <strong>{result.slug}</strong>: {result.status}
                        {result.message ? ` - ${result.message}` : ""}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/60 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-primary">Export catalogue</CardTitle>
          <CardDescription>Download a CSV snapshot of all products, prices, and shades.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            CSV columns include name, slug, price, collection, shade names/SKUs/quantities. Suitable for reports or offline edits.
          </div>
          <Button onClick={handleExport} disabled={exporting} className="rounded-full">
            {exporting ? "Preparing..." : "Export as CSV"}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
