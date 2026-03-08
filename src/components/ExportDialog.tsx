import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import JSZip from "jszip";

type ExportSection = "links" | "collections" | "analytics";
type ExportFormat = "json" | "csv" | "markdown" | "notion";

export function ExportDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<Set<ExportSection>>(new Set(["links"]));
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);

  const toggleSection = (s: ExportSection) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateMarkdownForCollection = (
    collection: { name: string; description?: string | null },
    links: { title?: string | null; original_url: string; summary?: string | null; tags?: string[] | null; notes?: string | null }[]
  ) => {
    let md = `# ${collection.name}\n\n`;
    if (collection.description) md += `> ${collection.description}\n\n`;
    md += `*${links.length} links*\n\n---\n\n`;
    for (const link of links) {
      md += `## [${link.title || link.original_url}](${link.original_url})\n\n`;
      if (link.summary) md += `${link.summary}\n\n`;
      if (link.tags?.length) md += `**Tags:** ${link.tags.map((t) => `\`${t}\``).join(" ")}\n\n`;
      if (link.notes) md += `**Notes:** ${link.notes}\n\n`;
      md += `---\n\n`;
    }
    return md;
  };

  const generateNotionCSVForCollection = (
    links: { title?: string | null; original_url: string; summary?: string | null; tags?: string[] | null; content_type?: string | null; status?: string | null; notes?: string | null; created_at?: string }[]
  ) => {
    // Notion database CSV format
    const headers = ["Name", "URL", "Summary", "Tags", "Type", "Status", "Notes", "Created"];
    const rows = [headers.join(",")];
    for (const link of links) {
      const row = [
        link.title || link.original_url,
        link.original_url,
        link.summary || "",
        (link.tags || []).join(", "),
        link.content_type || "",
        link.status || "",
        link.notes || "",
        link.created_at ? new Date(link.created_at).toISOString().slice(0, 10) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      rows.push(row.join(","));
    }
    return rows.join("\n");
  };

  const handleExport = async () => {
    if (sections.size === 0) return;
    setExporting(true);
    setDone(false);

    try {
      // Fetch data
      let allLinks: any[] = [];
      let allCollections: any[] = [];
      let allColLinks: any[] = [];

      if (sections.has("links") || sections.has("analytics") || format === "markdown" || format === "notion") {
        const { data, error } = await supabase
          .from("links")
          .select("id, original_url, canonical_url, domain, title, summary, tags, content_type, key_points, notes, status, is_pinned, save_count, confidence_score, created_at, updated_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (error) throw error;
        allLinks = data || [];
      }

      if (sections.has("collections") || format === "markdown" || format === "notion") {
        const { data: cols, error: colErr } = await supabase
          .from("collections")
          .select("id, name, description, icon, color, position, created_at")
          .order("position", { ascending: true });
        if (colErr) throw colErr;
        allCollections = cols || [];

        const { data: colLinks, error: clErr } = await supabase
          .from("collection_links")
          .select("collection_id, link_id, added_at");
        if (clErr) throw clErr;
        allColLinks = colLinks || [];
      }

      const linkMap = new Map(allLinks.map((l: any) => [l.id, l]));

      if (format === "markdown") {
        // Export as a ZIP of markdown files
        const zip = new JSZip();

        if (sections.has("links")) {
          let allMd = `# All Links\n\n*Exported ${new Date().toLocaleDateString()} — ${allLinks.length} links*\n\n---\n\n`;
          for (const link of allLinks) {
            allMd += `## [${link.title || link.original_url}](${link.original_url})\n\n`;
            if (link.domain) allMd += `📍 ${link.domain}`;
            if (link.content_type) allMd += ` • ${link.content_type}`;
            allMd += `\n\n`;
            if (link.summary) allMd += `${link.summary}\n\n`;
            if (link.key_points?.length) {
              allMd += `**Key Points:**\n`;
              link.key_points.forEach((p: string) => { allMd += `- ${p}\n`; });
              allMd += `\n`;
            }
            if (link.tags?.length) allMd += `**Tags:** ${link.tags.map((t: string) => `\`${t}\``).join(" ")}\n\n`;
            if (link.notes) allMd += `**Notes:** ${link.notes}\n\n`;
            allMd += `---\n\n`;
          }
          zip.file("all-links.md", allMd);
        }

        if (sections.has("collections")) {
          const collectionsFolder = zip.folder("collections");
          for (const col of allCollections) {
            const colLinkIds = allColLinks.filter((cl: any) => cl.collection_id === col.id).map((cl: any) => cl.link_id);
            const colLinks = colLinkIds.map((id: string) => linkMap.get(id)).filter(Boolean);
            const md = generateMarkdownForCollection(col, colLinks);
            const safeName = col.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
            collectionsFolder?.file(`${safeName}.md`, md);
          }
        }

        if (sections.has("analytics")) {
          const tagCounts: Record<string, number> = {};
          const domainCounts: Record<string, number> = {};
          allLinks.forEach((l: any) => {
            (l.tags || []).forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
            if (l.domain) domainCounts[l.domain] = (domainCounts[l.domain] || 0) + 1;
          });
          let analyticsMd = `# Analytics\n\n*${allLinks.length} total links*\n\n`;
          analyticsMd += `## Top Tags\n\n| Tag | Count |\n|-----|-------|\n`;
          Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 20).forEach(([tag, count]) => {
            analyticsMd += `| ${tag} | ${count} |\n`;
          });
          analyticsMd += `\n## Top Domains\n\n| Domain | Count |\n|--------|-------|\n`;
          Object.entries(domainCounts).sort(([, a], [, b]) => b - a).slice(0, 20).forEach(([domain, count]) => {
            analyticsMd += `| ${domain} | ${count} |\n`;
          });
          zip.file("analytics.md", analyticsMd);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `xenonowledge-export-${new Date().toISOString().slice(0, 10)}.zip`);
      } else if (format === "notion") {
        // Export as ZIP of Notion-ready CSV databases
        const zip = new JSZip();

        if (sections.has("links")) {
          const csv = generateNotionCSVForCollection(allLinks);
          zip.file("All Links - Notion Database.csv", csv);
        }

        if (sections.has("collections")) {
          for (const col of allCollections) {
            const colLinkIds = allColLinks.filter((cl: any) => cl.collection_id === col.id).map((cl: any) => cl.link_id);
            const colLinks = colLinkIds.map((id: string) => linkMap.get(id)).filter(Boolean);
            const csv = generateNotionCSVForCollection(colLinks);
            const safeName = col.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
            zip.file(`${safeName} - Notion Database.csv`, csv);
          }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `xenonowledge-notion-${new Date().toISOString().slice(0, 10)}.zip`);
      } else if (format === "json") {
        const exportData: Record<string, any> = { exportedAt: new Date().toISOString() };
        if (sections.has("links")) exportData.links = allLinks;
        if (sections.has("collections")) {
          exportData.collections = allCollections.map((c: any) => ({
            ...c,
            link_ids: allColLinks.filter((cl: any) => cl.collection_id === c.id).map((cl: any) => cl.link_id),
          }));
        }
        if (sections.has("analytics")) {
          const tagCounts: Record<string, number> = {};
          const domainCounts: Record<string, number> = {};
          const typeCounts: Record<string, number> = {};
          for (const link of allLinks) {
            (link.tags || []).forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
            if (link.domain) domainCounts[link.domain] = (domainCounts[link.domain] || 0) + 1;
            if (link.content_type) typeCounts[link.content_type] = (typeCounts[link.content_type] || 0) + 1;
          }
          exportData.analytics = {
            totalLinks: allLinks.length,
            byStatus: {
              ready: allLinks.filter((l: any) => l.status === "ready").length,
              pending: allLinks.filter((l: any) => l.status === "pending").length,
              failed: allLinks.filter((l: any) => l.status === "failed").length,
            },
            topTags: Object.entries(tagCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 20),
            topDomains: Object.entries(domainCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 20),
            contentTypes: typeCounts,
          };
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        downloadBlob(blob, `xenonowledge-export-${new Date().toISOString().slice(0, 10)}.json`);
      } else {
        // CSV
        if (allLinks.length === 0) {
          toast({ title: "No data to export", variant: "destructive" });
          setExporting(false);
          return;
        }
        const headers = ["title", "original_url", "domain", "content_type", "status", "tags", "summary", "notes", "is_pinned", "save_count", "created_at"];
        const csvRows = [headers.join(",")];
        for (const link of allLinks) {
          const row = headers.map((h) => {
            let val = link[h];
            if (Array.isArray(val)) val = val.join("; ");
            if (val === null || val === undefined) val = "";
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(row.join(","));
        }
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        downloadBlob(blob, `xenonowledge-links-${new Date().toISOString().slice(0, 10)}.csv`);
      }

      setDone(true);
      toast({ title: "Export complete!" });
      setTimeout(() => setDone(false), 2000);
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const sectionOptions: { key: ExportSection; label: string; description: string }[] = [
    { key: "links", label: "Links", description: "All saved links with metadata, tags, notes" },
    { key: "collections", label: "Collections", description: "Collections with their associated links" },
    { key: "analytics", label: "Analytics", description: "Tag/domain/status breakdowns" },
  ];

  const formatOptions: { key: ExportFormat; label: string; icon: React.ReactNode; badge?: string }[] = [
    { key: "json", label: "JSON", icon: <FileJson className="h-4 w-4" />, badge: "full" },
    { key: "csv", label: "CSV", icon: <FileSpreadsheet className="h-4 w-4" />, badge: "links" },
    { key: "markdown", label: "Markdown", icon: <FileText className="h-4 w-4" />, badge: "zip" },
    { key: "notion", label: "Notion", icon: <FileSpreadsheet className="h-4 w-4" />, badge: "csv zip" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDone(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-mono gap-1.5">
          <Download className="h-3 w-3" /> Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Download className="h-4 w-4" /> Export Data
          </DialogTitle>
          <DialogDescription>
            Choose what to export and your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Data to export</Label>
            {sectionOptions.map(({ key, label, description }) => (
              <label
                key={key}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                  sections.has(key) ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
                )}
              >
                <Checkbox
                  checked={sections.has(key)}
                  onCheckedChange={() => toggleSection(key)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Format</Label>
            <div className="grid grid-cols-2 gap-2">
              {formatOptions.map(({ key, label, icon, badge }) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-mono cursor-pointer transition-all duration-200",
                    format === key ? "border-primary/40 bg-primary/5 text-primary" : "border-border hover:border-primary/20"
                  )}
                >
                  {icon} {label}
                  {badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>}
                </button>
              ))}
            </div>
            {format === "notion" && (
              <p className="text-xs text-muted-foreground">
                Exports Notion-ready CSV databases that can be imported directly into Notion pages.
              </p>
            )}
            {format === "markdown" && (
              <p className="text-xs text-muted-foreground">
                Exports as a ZIP of .md files — compatible with Obsidian, Logseq, or any markdown editor.
              </p>
            )}
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || sections.size === 0}
            className="w-full font-mono gap-2 group"
          >
            {exporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
            ) : done ? (
              <><Check className="h-4 w-4" /> Done!</>
            ) : (
              <><Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" /> Export {format === "notion" ? "Notion CSV" : format.toUpperCase()}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}