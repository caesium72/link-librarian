import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, ZoomIn, ZoomOut, Maximize2, GripHorizontal,
  ExternalLink, Filter, MapIcon,
} from "lucide-react";
import type { Link } from "@/types/links";

interface GraphNode {
  id: string;
  label: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

function buildGraph(links: Link[]) {
  const tagCount: Record<string, number> = {};
  const cooccurrence: Record<string, number> = {};
  const tagLinks: Record<string, Link[]> = {};

  for (const link of links) {
    const tags = link.tags || [];
    for (const tag of tags) {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
      if (!tagLinks[tag]) tagLinks[tag] = [];
      tagLinks[tag].push(link);
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i], tags[j]].sort().join("|||");
        cooccurrence[key] = (cooccurrence[key] || 0) + 1;
      }
    }
  }

  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([tag]) => tag);

  const topSet = new Set(topTags);
  const maxC = Math.max(...topTags.map((t) => tagCount[t]), 1);

  const nodes: GraphNode[] = topTags.map((tag, i) => {
    const angle = (2 * Math.PI * i) / topTags.length;
    const radius = 250;
    const r = 12 + (tagCount[tag] / maxC) * 22;
    return {
      id: tag,
      label: tag,
      count: tagCount[tag],
      x: 400 + radius * Math.cos(angle) + (Math.random() - 0.5) * 30,
      y: 350 + radius * Math.sin(angle) + (Math.random() - 0.5) * 30,
      vx: 0,
      vy: 0,
      radius: r,
    };
  });

  const edges: GraphEdge[] = [];
  for (const [key, weight] of Object.entries(cooccurrence)) {
    const [a, b] = key.split("|||");
    if (topSet.has(a) && topSet.has(b)) {
      edges.push({ source: a, target: b, weight });
    }
  }

  return { nodes, edges, tagLinks };
}

interface SimPositions {
  x: number;
  y: number;
}

function useSimulation(
  initialNodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
) {
  const nodesRef = useRef<GraphNode[]>([]);
  const [positions, setPositions] = useState<SimPositions[]>([]);
  const frameRef = useRef<number>(0);
  const iterRef = useRef(0);
  const dragRef = useRef<string | null>(null);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);
  // Interpolated display positions for smooth rendering
  const displayRef = useRef<SimPositions[]>([]);

  useEffect(() => {
    if (initialNodes.length === 0) return;

    nodesRef.current = initialNodes.map((n) => ({ ...n }));
    iterRef.current = 0;
    displayRef.current = initialNodes.map((n) => ({ x: n.x, y: n.y }));

    const cx = width / 2;
    const cy = height / 2;
    const nodeMap = new Map<string, GraphNode>(nodesRef.current.map((n) => [n.id, n] as [string, GraphNode]));
    const padding = 60;

    const tick = () => {
      const nodes = nodesRef.current;
      // Smooth alpha decay: starts fast, slows gracefully
      const progress = iterRef.current / 500;
      const alpha = Math.max(0.002, Math.exp(-3 * progress));

      // Apply drag position
      if (dragRef.current && dragPosRef.current) {
        const dragNode = nodeMap.get(dragRef.current);
        if (dragNode) {
          dragNode.x = dragPosRef.current.x;
          dragNode.y = dragPosRef.current.y;
          dragNode.vx = 0;
          dragNode.vy = 0;
        }
      }

      // Repulsion (with collision avoidance using node radii)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const minDist = nodes[i].radius + nodes[j].radius + 20; // minimum gap

          // Standard repulsion
          let force = (1200 * alpha) / (dist * dist);

          // Extra collision force when overlapping
          if (dist < minDist) {
            force += ((minDist - dist) / minDist) * 8 * alpha;
          }

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (nodes[i].id !== dragRef.current) {
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
          }
          if (nodes[j].id !== dragRef.current) {
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const s = nodeMap.get(edge.source);
        const t = nodeMap.get(edge.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const idealDist = s.radius + t.radius + 60;
        const force = (dist - idealDist) * 0.006 * alpha * Math.min(edge.weight, 5);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (s.id !== dragRef.current) { s.vx += fx; s.vy += fy; }
        if (t.id !== dragRef.current) { t.vx -= fx; t.vy -= fy; }
      }

      // Center gravity
      for (const node of nodes) {
        if (node.id === dragRef.current) continue;
        node.vx += (cx - node.x) * 0.004 * alpha;
        node.vy += (cy - node.y) * 0.004 * alpha;
      }

      // Apply velocity with smooth damping
      const damping = 0.7;
      for (const node of nodes) {
        if (node.id === dragRef.current) continue;
        node.vx *= damping;
        node.vy *= damping;
        // Clamp max velocity for stability
        const maxV = 8;
        node.vx = Math.max(-maxV, Math.min(maxV, node.vx));
        node.vy = Math.max(-maxV, Math.min(maxV, node.vy));
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(padding, Math.min(width - padding, node.x));
        node.y = Math.max(padding, Math.min(height - padding, node.y));
      }

      // Smooth interpolation for display positions (lerp)
      const lerpFactor = 0.35;
      const newDisplay = nodes.map((n, i) => {
        const prev = displayRef.current[i] || { x: n.x, y: n.y };
        return {
          x: prev.x + (n.x - prev.x) * lerpFactor,
          y: prev.y + (n.y - prev.y) * lerpFactor,
        };
      });
      displayRef.current = newDisplay;

      setPositions([...newDisplay]);
      iterRef.current++;

      if (iterRef.current < 600 || dragRef.current) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [initialNodes, edges, width, height]);

  const startDrag = useCallback((nodeId: string) => {
    dragRef.current = nodeId;
    iterRef.current = Math.min(iterRef.current, 500);
  }, []);

  const updateDrag = useCallback((x: number, y: number) => {
    dragPosRef.current = { x, y };
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    dragPosRef.current = null;
  }, []);

  return { nodes: initialNodes, positions, startDrag, updateDrag, endDrag };
}

// ─── Minimap Component ───
function Minimap({
  nodes,
  positions,
  edges,
  dims,
  zoom,
  pan,
  selectedTag,
  connectedTags,
  onNavigate,
}: {
  nodes: GraphNode[];
  positions: SimPositions[];
  edges: GraphEdge[];
  dims: { w: number; h: number };
  zoom: number;
  pan: { x: number; y: number };
  selectedTag: string | null;
  connectedTags: Set<string>;
  onNavigate: (x: number, y: number) => void;
}) {
  const mmW = 160;
  const mmH = (dims.h / dims.w) * mmW;
  const scale = mmW / dims.w;

  // Viewport rectangle in minimap coords
  const vpX = (-pan.x / zoom) * scale;
  const vpY = (-pan.y / zoom) * scale;
  const vpW = (dims.w / zoom) * scale;
  const vpH = (dims.h / zoom) * scale;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convert minimap coords to graph coords, then to pan
    const gx = mx / scale;
    const gy = my / scale;
    onNavigate(gx, gy);
  };

  return (
    <div className="absolute bottom-3 right-3 rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-right-2 zoom-in-95 duration-300">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border/40">
        <MapIcon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground font-medium">Minimap</span>
      </div>
      <svg
        width={mmW}
        height={mmH}
        className="bg-muted/30 cursor-crosshair"
        onClick={handleClick}
      >
        {/* Edges */}
        {edges.map((edge) => {
          const si = nodes.findIndex((n) => n.id === edge.source);
          const ti = nodes.findIndex((n) => n.id === edge.target);
          const s = positions[si];
          const t = positions[ti];
          if (!s || !t) return null;
          return (
            <line
              key={`mm-${edge.source}-${edge.target}`}
              x1={s.x * scale}
              y1={s.y * scale}
              x2={t.x * scale}
              y2={t.y * scale}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node, idx) => {
          const pos = positions[idx];
          if (!pos) return null;
          const isSelected = selectedTag === node.id;
          const isConnected = connectedTags.has(node.id);
          return (
            <circle
              key={`mm-${node.id}`}
              cx={pos.x * scale}
              cy={pos.y * scale}
              r={Math.max(2, node.radius * scale * 0.6)}
              fill={
                isSelected
                  ? "hsl(var(--primary))"
                  : isConnected
                  ? "hsl(var(--primary) / 0.6)"
                  : "hsl(var(--primary) / 0.3)"
              }
            />
          );
        })}

        {/* Viewport rect */}
        <rect
          x={vpX}
          y={vpY}
          width={vpW}
          height={vpH}
          fill="hsl(var(--primary) / 0.08)"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          rx={2}
        />
      </svg>
    </div>
  );
}

// ─── Main Component ───
interface KnowledgeGraphProps {
  links: Link[];
  isLoading: boolean;
}

export function KnowledgeGraph({ links, isLoading }: KnowledgeGraphProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [expandAnim, setExpandAnim] = useState(0); // 0-1 animation progress
  const expandAnimRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDims({ w: width, h: Math.max(480, Math.min(width * 0.7, 650)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes: initialNodes, edges, tagLinks } = useMemo(
    () => buildGraph(links),
    [links]
  );

  const { nodes, positions, startDrag, updateDrag, endDrag } = useSimulation(
    initialNodes,
    edges,
    dims.w,
    dims.h
  );

  const maxCount = useMemo(
    () => Math.max(...initialNodes.map((n) => n.count), 1),
    [initialNodes]
  );
  const maxWeight = useMemo(
    () => Math.max(...edges.map((e) => e.weight), 1),
    [edges]
  );

  const matchedTags = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(initialNodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));
  }, [searchQuery, initialNodes]);

  const connectedTags = useMemo(() => {
    if (!selectedTag) return new Set<string>();
    const set = new Set<string>();
    for (const e of edges) {
      if (e.source === selectedTag) set.add(e.target);
      if (e.target === selectedTag) set.add(e.source);
    }
    return set;
  }, [selectedTag, edges]);

  const selectedTagLinks = useMemo(() => {
    if (!selectedTag || !tagLinks[selectedTag]) return [];
    return tagLinks[selectedTag].slice(0, 10);
  }, [selectedTag, tagLinks]);

  // Satellite atoms for expanded node
  const expandedSatellites = useMemo(() => {
    if (!expandedTag || !tagLinks[expandedTag]) return [];
    const satLinks = tagLinks[expandedTag].slice(0, 8);
    const nodeIdx = nodes.findIndex((n) => n.id === expandedTag);
    const centerPos = positions[nodeIdx] || { x: 400, y: 350 };
    const parentR = nodes[nodeIdx]?.radius || 20;
    const orbitRadius = parentR + 55;
    return satLinks.map((link, i) => {
      const angle = (2 * Math.PI * i) / satLinks.length - Math.PI / 2;
      return {
        link,
        x: centerPos.x + orbitRadius * Math.cos(angle),
        y: centerPos.y + orbitRadius * Math.sin(angle),
        cx: centerPos.x,
        cy: centerPos.y,
      };
    });
  }, [expandedTag, tagLinks, nodes, positions]);

  // Expand animation driver
  useEffect(() => {
    if (expandedTag) {
      let start: number | null = null;
      const duration = 400;
      const animate = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setExpandAnim(eased);
        if (progress < 1) {
          expandAnimRef.current = requestAnimationFrame(animate);
        }
      };
      setExpandAnim(0);
      expandAnimRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(expandAnimRef.current);
    } else {
      setExpandAnim(0);
    }
  }, [expandedTag]);

  const getNodePos = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx === -1 || !positions[idx]) return { x: 0, y: 0 };
      return positions[idx];
    },
    [nodes, positions]
  );

  const handleNodeClick = useCallback((nodeId: string) => {
    if (draggingNode) return;
    if (expandedTag === nodeId) {
      setExpandedTag(null);
      setSelectedTag(null);
    } else if (selectedTag === nodeId) {
      // Second click on selected → expand
      setExpandedTag(nodeId);
    } else {
      setExpandedTag(null);
      setSelectedTag(nodeId);
    }
  }, [selectedTag, expandedTag, draggingNode]);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.3, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.3, 0.3));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedTag(null); setExpandedTag(null); setSearchQuery(""); };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (draggingNode) return;
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan, draggingNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      updateDrag(x, y);
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart, draggingNode, zoom, pan, updateDrag]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode) {
      setDraggingNode(null);
      endDrag();
    }
    setIsPanning(false);
  }, [draggingNode, endDrag]);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingNode(nodeId);
    startDrag(nodeId);
  }, [startDrag]);

  // Minimap navigation: center view on clicked point
  const handleMinimapNavigate = useCallback((gx: number, gy: number) => {
    setPan({
      x: -(gx * zoom - dims.w / 2),
      y: -(gy * zoom - dims.h / 2),
    });
  }, [zoom, dims]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[480px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (initialNodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tags found. Add tags to your links to see the knowledge graph.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap animate-in fade-in slide-in-from-bottom-2 duration-400">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleReset} title="Reset view">
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={showMinimap ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowMinimap((v) => !v)}
            title="Toggle minimap"
          >
            <MapIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <GripHorizontal className="h-3.5 w-3.5" />
          <span>Drag nodes · Scroll to zoom · Click to select</span>
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        <Card className="overflow-hidden relative">
          <CardContent className="p-0">
            <svg
              ref={svgRef}
              width={dims.w}
              height={dims.h}
              className="bg-muted/20 select-none"
              style={{ cursor: draggingNode ? "grabbing" : isPanning ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => { if (!draggingNode) setSelectedTag(null); }}
            >
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {/* Edges with smooth curves */}
                {edges.map((edge) => {
                  const s = getNodePos(edge.source);
                  const t = getNodePos(edge.target);
                  const isHighlighted =
                    selectedTag &&
                    (edge.source === selectedTag || edge.target === selectedTag);
                  const isSearchMatch =
                    searchQuery && (matchedTags.has(edge.source) || matchedTags.has(edge.target));
                  const isDimmed = (selectedTag || searchQuery) && !isHighlighted && !isSearchMatch;

                  // Curved edge using quadratic bezier
                  const mx = (s.x + t.x) / 2;
                  const my = (s.y + t.y) / 2;
                  const dx = t.x - s.x;
                  const dy = t.y - s.y;
                  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                  const curvature = Math.min(dist * 0.08, 20);
                  const cx = mx + (-dy / dist) * curvature;
                  const cy = my + (dx / dist) * curvature;

                  return (
                    <path
                      key={`${edge.source}-${edge.target}`}
                      d={`M ${s.x} ${s.y} Q ${cx} ${cy} ${t.x} ${t.y}`}
                      fill="none"
                      stroke={
                        isHighlighted
                          ? "hsl(var(--primary))"
                          : isSearchMatch
                          ? "hsl(var(--chart-2))"
                          : "hsl(var(--border))"
                      }
                      strokeWidth={Math.max(1, (edge.weight / maxWeight) * 3.5)}
                      strokeOpacity={isDimmed ? 0.06 : isHighlighted ? 0.85 : isSearchMatch ? 0.65 : 0.3}
                      style={{ transition: "stroke-opacity 0.3s ease" }}
                    />
                  );
                })}

                {/* Atom Nodes */}
                {nodes.map((node, idx) => {
                  const pos = positions[idx] || { x: node.x, y: node.y };
                  const r = node.radius;
                  const isSelected = selectedTag === node.id;
                  const isConnected = connectedTags.has(node.id);
                  const isSearched = matchedTags.has(node.id);
                  const isDimmed =
                    (selectedTag && !isSelected && !isConnected) ||
                    (searchQuery && !isSearched && !selectedTag);

                  const accentColor = isSelected
                    ? "hsl(var(--primary))"
                    : isSearched
                    ? "hsl(var(--chart-2))"
                    : isConnected
                    ? "hsl(var(--primary) / 0.6)"
                    : "hsl(var(--primary) / 0.35)";

                  const nucleusColor = isSelected
                    ? "hsl(var(--primary))"
                    : isSearched
                    ? "hsl(var(--chart-2))"
                    : isConnected
                    ? "hsl(var(--primary) / 0.7)"
                    : "hsl(var(--primary) / 0.5)";

                  // Electron orbit count based on node size
                  const orbitCount = r > 25 ? 3 : r > 18 ? 2 : 1;
                  const nucleusR = Math.max(4, r * 0.32);
                  // Electron count scales with link count
                  const electronCount = Math.min(node.count, orbitCount * 2 + 1);

                  return (
                    <g
                      key={node.id}
                      style={{
                        cursor: draggingNode === node.id ? "grabbing" : "pointer",
                        transition: "opacity 0.3s ease",
                      }}
                      opacity={isDimmed ? 0.15 : 1}
                      onMouseDown={(e) => handleNodeDragStart(e, node.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeClick(node.id);
                      }}
                    >
                      {/* Outer energy glow */}
                      {(isSelected || isSearched) && (
                        <>
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={r + 10}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={1}
                            strokeOpacity={0.15}
                          >
                            <animate attributeName="r" values={`${r + 8};${r + 14};${r + 8}`} dur="2.5s" repeatCount="indefinite" />
                            <animate attributeName="stroke-opacity" values="0.15;0.05;0.15" dur="2.5s" repeatCount="indefinite" />
                          </circle>
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={r + 4}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={1.5}
                            strokeOpacity={0.25}
                          />
                        </>
                      )}

                      {/* Electron orbits (elliptical rings) */}
                      {Array.from({ length: orbitCount }).map((_, oi) => {
                        const orbitR = nucleusR + (r - nucleusR) * ((oi + 1) / orbitCount) * 0.95 + 4;
                        const tiltAngle = oi * (180 / orbitCount) - 30;
                        const eccentricity = 0.55 + oi * 0.1;
                        return (
                          <ellipse
                            key={`orbit-${node.id}-${oi}`}
                            cx={pos.x}
                            cy={pos.y}
                            rx={orbitR}
                            ry={orbitR * eccentricity}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={isSelected ? 0.8 : 0.5}
                            strokeOpacity={isSelected ? 0.5 : 0.25}
                            strokeDasharray={oi % 2 === 0 ? "none" : "2 3"}
                            transform={`rotate(${tiltAngle}, ${pos.x}, ${pos.y})`}
                            style={{ transition: "stroke-opacity 0.3s ease" }}
                          />
                        );
                      })}

                      {/* Electrons (orbiting dots via rotating group) */}
                      {Array.from({ length: electronCount }).map((_, ei) => {
                        const orbitIdx = ei % orbitCount;
                        const orbitR = nucleusR + (r - nucleusR) * ((orbitIdx + 1) / orbitCount) * 0.95 + 4;
                        const tiltAngle = orbitIdx * (180 / orbitCount) - 30;
                        const speed = 3 + orbitIdx * 1.5 + ei * 0.7;
                        const electronR = Math.max(1.5, nucleusR * 0.3);
                        const electronColor = isSearched ? "hsl(var(--chart-2))" : "hsl(var(--primary))";
                        const startAngle = (ei * 360) / electronCount;

                        return (
                          <g
                            key={`electron-${node.id}-${ei}`}
                            transform={`rotate(${tiltAngle}, ${pos.x}, ${pos.y})`}
                          >
                            <g>
                              <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`${startAngle} ${pos.x} ${pos.y}`}
                                to={`${startAngle + 360} ${pos.x} ${pos.y}`}
                                dur={`${speed}s`}
                                repeatCount="indefinite"
                              />
                              <circle
                                cx={pos.x + orbitR}
                                cy={pos.y}
                                r={electronR}
                                fill={electronColor}
                                fillOpacity={isSelected ? 1 : 0.8}
                              />
                              <circle
                                cx={pos.x + orbitR}
                                cy={pos.y}
                                r={electronR * 2.5}
                                fill={electronColor}
                                fillOpacity={0.12}
                              />
                            </g>
                          </g>
                        );
                      })}

                      {/* Nucleus (core sphere with gradient feel) */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={nucleusR + 2}
                        fill={nucleusColor}
                        fillOpacity={0.15}
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={nucleusR}
                        fill={nucleusColor}
                        stroke={accentColor}
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ transition: "fill 0.3s ease, stroke 0.3s ease" }}
                      />
                      {/* Nucleus highlight */}
                      <circle
                        cx={pos.x - nucleusR * 0.25}
                        cy={pos.y - nucleusR * 0.25}
                        r={nucleusR * 0.35}
                        fill="hsl(var(--background))"
                        fillOpacity={0.3}
                      />

                      {/* Count inside nucleus */}
                      <text
                        x={pos.x}
                        y={pos.y + (nucleusR > 6 ? 3 : 2.5)}
                        textAnchor="middle"
                        fontSize={nucleusR > 6 ? 8 : 6}
                        fill="hsl(var(--primary-foreground))"
                        fontWeight={700}
                        className="select-none pointer-events-none"
                      >
                        {node.count}
                      </text>

                      {/* Label below */}
                      <text
                        x={pos.x}
                        y={pos.y + r + 16}
                        textAnchor="middle"
                        fontSize={10}
                        fill="hsl(var(--foreground))"
                        fontWeight={isSelected || isSearched ? 600 : 400}
                        className="select-none pointer-events-none"
                        style={{ transition: "font-weight 0.2s ease" }}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}

                {/* Expanded satellite link-atoms */}
                {expandedTag && expandAnim > 0 && expandedSatellites.map((sat, si) => {
                  const satR = 6;
                  const progress = expandAnim;
                  // Animate from center outward
                  const sx = sat.cx + (sat.x - sat.cx) * progress;
                  const sy = sat.cy + (sat.y - sat.cy) * progress;
                  const chartColors = [
                    "hsl(var(--chart-1))",
                    "hsl(var(--chart-2))",
                    "hsl(var(--chart-3))",
                    "hsl(var(--chart-4))",
                    "hsl(var(--chart-5))",
                  ];
                  const satColor = chartColors[si % chartColors.length];

                  return (
                    <g key={`sat-${sat.link.id}`} opacity={progress}>
                      {/* Connection line from parent to satellite */}
                      <line
                        x1={sat.cx}
                        y1={sat.cy}
                        x2={sx}
                        y2={sy}
                        stroke={satColor}
                        strokeWidth={0.8}
                        strokeOpacity={0.4 * progress}
                        strokeDasharray="3 2"
                      />
                      {/* Satellite orbit ring */}
                      <circle
                        cx={sx}
                        cy={sy}
                        r={satR + 4}
                        fill="none"
                        stroke={satColor}
                        strokeWidth={0.4}
                        strokeOpacity={0.3 * progress}
                      />
                      {/* Satellite nucleus */}
                      <circle
                        cx={sx}
                        cy={sy}
                        r={satR + 1}
                        fill={satColor}
                        fillOpacity={0.1 * progress}
                      />
                      <circle
                        cx={sx}
                        cy={sy}
                        r={satR}
                        fill={satColor}
                        fillOpacity={0.7 * progress}
                        stroke={satColor}
                        strokeWidth={0.8}
                      />
                      {/* Tiny orbiting electron */}
                      <g>
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from={`0 ${sx} ${sy}`}
                          to={`360 ${sx} ${sy}`}
                          dur={`${2 + si * 0.3}s`}
                          repeatCount="indefinite"
                        />
                        <circle
                          cx={sx + satR + 3}
                          cy={sy}
                          r={1.2}
                          fill={satColor}
                        />
                      </g>
                      {/* Satellite highlight */}
                      <circle
                        cx={sx - satR * 0.2}
                        cy={sy - satR * 0.2}
                        r={satR * 0.3}
                        fill="hsl(var(--background))"
                        fillOpacity={0.25 * progress}
                      />
                      {/* Link title label */}
                      <text
                        x={sx}
                        y={sy + satR + 10}
                        textAnchor="middle"
                        fontSize={7}
                        fill="hsl(var(--foreground))"
                        fillOpacity={progress}
                        className="select-none pointer-events-none"
                      >
                        {(sat.link.title || sat.link.domain || "Link").slice(0, 18)}
                        {(sat.link.title || "").length > 18 ? "…" : ""}
                      </text>
                      {/* Clickable overlay */}
                      <a
                        href={sat.link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <circle
                          cx={sx}
                          cy={sy}
                          r={satR + 4}
                          fill="transparent"
                          cursor="pointer"
                        />
                      </a>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Minimap overlay */}
            {showMinimap && positions.length > 0 && (
              <Minimap
                nodes={nodes}
                positions={positions}
                edges={edges}
                dims={dims}
                zoom={zoom}
                pan={pan}
                selectedTag={selectedTag}
                connectedTags={connectedTags}
                onNavigate={handleMinimapNavigate}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail panel */}
      {selectedTag && (
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-400 hover:border-primary/20 transition-all">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between animate-in fade-in slide-in-from-left-2 duration-300">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary animate-pulse" />
                Tag: <Badge variant="default" className="animate-in zoom-in-95 duration-200">{selectedTag}</Badge>
                <span className="text-muted-foreground font-normal">
                  · {tagLinks[selectedTag]?.length || 0} links
                </span>
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-7 hover:text-destructive transition-colors duration-200" onClick={() => setSelectedTag(null)}>
                Clear
              </Button>
            </div>

            {connectedTags.size > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "100ms", animationFillMode: "both" }}>
                <p className="text-xs text-muted-foreground mb-1.5">Connected tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(connectedTags).map((tag, i) => {
                    const edge = edges.find(
                      (e) =>
                        (e.source === selectedTag && e.target === tag) ||
                        (e.target === selectedTag && e.source === tag)
                    );
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-secondary/80 hover:scale-105 hover:shadow-sm transition-all duration-200 animate-in fade-in zoom-in-90"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                        onClick={() => setSelectedTag(tag)}
                      >
                        {tag}
                        {edge && (
                          <span className="ml-1 text-muted-foreground">×{edge.weight}</span>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedTagLinks.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "200ms", animationFillMode: "both" }}>
                <p className="text-xs text-muted-foreground mb-1.5">Links with this tag</p>
                <div className="space-y-1.5">
                  {selectedTagLinks.map((link, i) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted hover:-translate-y-px hover:shadow-sm transition-all duration-200 group animate-in fade-in slide-in-from-left-2"
                      style={{ animationDelay: `${200 + i * 60}ms`, animationFillMode: "both" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate group-hover:text-primary transition-colors duration-200">{link.title || "Untitled"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{link.domain}</p>
                      </div>
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  ))}
                  {(tagLinks[selectedTag]?.length || 0) > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center animate-in fade-in duration-500" style={{ animationDelay: "500ms" }}>
                      +{(tagLinks[selectedTag]?.length || 0) - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
