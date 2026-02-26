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
import { Download, FileJson, FileSpreadsheet, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ExportSection = "links" | "collections" | "analytics";
type ExportFormat = "json" | "csv";

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

  const handleExport = async () => {
    if (sections.size === 0) return;
    setExporting(true);
    setDone(false);

    try {
      const exportData: Record<string, any> = { exportedAt: new Date().toISOString() };

      if (sections.has("links")) {
        const { data, error } = await supabase
          .from("links")
          .select("id, original_url, canonical_url, domain, title, summary, tags, content_type, key_points, notes, status, is_pinned, save_count, confidence_score, created_at, updated_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        exportData.links = data || [];
      }

      if (sections.has("collections")) {
        const { data: cols, error: colErr } = await supabase
          .from("collections")
          .select("id, name, description, icon, color, position, created_at")
          .order("position", { ascending: true });
        if (colErr) throw colErr;

        const { data: colLinks, error: clErr } = await supabase
          .from("collection_links")
          .select("collection_id, link_id, added_at");
        if (clErr) throw clErr;

        exportData.collections = (cols || []).map((c: any) => ({
          ...c,
          link_ids: (colLinks || []).filter((cl: any) => cl.collection_id === c.id).map((cl: any) => cl.link_id),
        }));
      }

      if (sections.has("analytics")) {
        const links = exportData.links || (await supabase.from("links").select("*").order("created_at", { ascending: false })).data || [];
        const tagCounts: Record<string, number> = {};
        const domainCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};

        for (const link of links) {
          (link.tags || []).forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
          if (link.domain) domainCounts[link.domain] = (domainCounts[link.domain] || 0) + 1;
          if (link.content_type) typeCounts[link.content_type] = (typeCounts[link.content_type] || 0) + 1;
        }

        exportData.analytics = {
          totalLinks: links.length,
          byStatus: {
            ready: links.filter((l: any) => l.status === "ready").length,
            pending: links.filter((l: any) => l.status === "pending").length,
            failed: links.filter((l: any) => l.status === "failed").length,
          },
          topTags: Object.entries(tagCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 20),
          topDomains: Object.entries(domainCounts).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 20),
          contentTypes: typeCounts,
        };
      }

      let blob: Blob;
      let filename: string;

      if (format === "json") {
        blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        filename = `xenonowledge-export-${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        // CSV — flatten links
        const links = exportData.links || [];
        if (links.length === 0) {
          toast({ title: "No data to export", variant: "destructive" });
          setExporting(false);
          return;
        }
        const headers = ["title", "original_url", "domain", "content_type", "status", "tags", "summary", "notes", "is_pinned", "save_count", "created_at"];
        const csvRows = [headers.join(",")];
        for (const link of links) {
          const row = headers.map((h) => {
            let val = link[h];
            if (Array.isArray(val)) val = val.join("; ");
            if (val === null || val === undefined) val = "";
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(row.join(","));
        }
        blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        filename = `xenonowledge-links-${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDone(true);
      toast({ title: "Export complete!", description: filename });
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
            <div className="flex gap-2">
              <button
                onClick={() => setFormat("json")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-mono cursor-pointer transition-all duration-200",
                  format === "json" ? "border-primary/40 bg-primary/5 text-primary" : "border-border hover:border-primary/20"
                )}
              >
                <FileJson className="h-4 w-4" /> JSON
                {sections.size > 1 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">full</Badge>}
              </button>
              <button
                onClick={() => setFormat("csv")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-mono cursor-pointer transition-all duration-200",
                  format === "csv" ? "border-primary/40 bg-primary/5 text-primary" : "border-border hover:border-primary/20"
                )}
              >
                <FileSpreadsheet className="h-4 w-4" /> CSV
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">links only</Badge>
              </button>
            </div>
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
              <><Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" /> Export {format.toUpperCase()}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
