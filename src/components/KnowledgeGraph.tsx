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
    <div className="absolute bottom-3 right-3 rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm shadow-lg overflow-hidden">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
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

  const getNodePos = useCallback(
    (id: string) => {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx === -1 || !positions[idx]) return { x: 0, y: 0 };
      return positions[idx];
    },
    [nodes, positions]
  );

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.3, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.3, 0.3));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedTag(null); setSearchQuery(""); };

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
      <div className="flex items-center gap-2 flex-wrap">
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

                {/* Nodes */}
                {nodes.map((node, idx) => {
                  const pos = positions[idx] || { x: node.x, y: node.y };
                  const r = node.radius;
                  const isSelected = selectedTag === node.id;
                  const isConnected = connectedTags.has(node.id);
                  const isSearched = matchedTags.has(node.id);
                  const isDimmed =
                    (selectedTag && !isSelected && !isConnected) ||
                    (searchQuery && !isSearched && !selectedTag);

                  let fillColor = "hsl(var(--primary) / 0.22)";
                  if (isSelected) fillColor = "hsl(var(--primary))";
                  else if (isConnected) fillColor = "hsl(var(--primary) / 0.5)";
                  else if (isSearched) fillColor = "hsl(var(--chart-2))";

                  let strokeColor = "hsl(var(--border))";
                  if (isSelected) strokeColor = "hsl(var(--primary))";
                  else if (isSearched) strokeColor = "hsl(var(--chart-2))";

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
                        if (!draggingNode) setSelectedTag(selectedTag === node.id ? null : node.id);
                      }}
                    >
                      {/* Outer glow for selected/searched */}
                      {(isSelected || isSearched) && (
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={r + 6}
                          fill="none"
                          stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--chart-2))"}
                          strokeWidth={2}
                          strokeOpacity={0.25}
                          style={{ transition: "r 0.3s ease" }}
                        />
                      )}
                      {/* Node circle */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={r}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isSelected ? 2.5 : 1}
                        style={{ transition: "fill 0.3s ease, stroke 0.3s ease" }}
                      />
                      {/* Label */}
                      <text
                        x={pos.x}
                        y={pos.y + r + 14}
                        textAnchor="middle"
                        fontSize={10}
                        fill="hsl(var(--foreground))"
                        fontWeight={isSelected || isSearched ? 600 : 400}
                        className="select-none pointer-events-none"
                        style={{ transition: "font-weight 0.2s ease" }}
                      >
                        {node.label}
                      </text>
                      {/* Count */}
                      <text
                        x={pos.x}
                        y={pos.y + 4}
                        textAnchor="middle"
                        fontSize={r > 18 ? 10 : 8}
                        fill="hsl(var(--primary-foreground))"
                        fontWeight={600}
                        className="select-none pointer-events-none"
                      >
                        {node.count}
                      </text>
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
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-primary" />
                Tag: <Badge variant="default">{selectedTag}</Badge>
                <span className="text-muted-foreground font-normal">
                  · {tagLinks[selectedTag]?.length || 0} links
                </span>
              </p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setSelectedTag(null)}>
                Clear
              </Button>
            </div>

            {connectedTags.size > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Connected tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(connectedTags).map((tag) => {
                    const edge = edges.find(
                      (e) =>
                        (e.source === selectedTag && e.target === tag) ||
                        (e.target === selectedTag && e.source === tag)
                    );
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
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
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Links with this tag</p>
                <div className="space-y-1.5">
                  {selectedTagLinks.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{link.title || "Untitled"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{link.domain}</p>
                      </div>
                      <a
                        href={link.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    </div>
                  ))}
                  {(tagLinks[selectedTag]?.length || 0) > 10 && (
                    <p className="text-[10px] text-muted-foreground text-center">
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
