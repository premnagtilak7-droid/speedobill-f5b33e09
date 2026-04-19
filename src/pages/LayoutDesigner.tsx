import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Layers, GripVertical, RotateCcw, MousePointer2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface TableItem {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  section_name: string;
  position_x: number;
  position_y: number;
}

interface Section {
  id: string;
  name: string;
  color: string;
}

const statusBorder: Record<string, string> = {
  empty: "border-table-empty",
  occupied: "border-table-occupied",
  reserved: "border-table-reserved",
  cleaning: "border-table-cleaning",
};

const statusBg: Record<string, string> = {
  empty: "bg-table-empty/10",
  occupied: "bg-table-occupied/10",
  reserved: "bg-table-reserved/10",
  cleaning: "bg-table-cleaning/10",
};

const statusDots: Record<string, string> = {
  empty: "bg-table-empty",
  occupied: "bg-table-occupied",
  reserved: "bg-table-reserved",
  cleaning: "bg-table-cleaning",
};

const LayoutDesigner = () => {
  const { hotelId } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tables, setTables] = useState<TableItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState("All");
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [addOpen, setAddOpen] = useState(false);
  const [newCapacity, setNewCapacity] = useState("4");
  const [newSection, setNewSection] = useState("Main");

  const [sectionOpen, setSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionColor, setSectionColor] = useState("#F97316");

  const fetchData = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const [tablesRes, sectionsRes] = await Promise.all([
      supabase.from("restaurant_tables")
        .select("id, table_number, capacity, status, section_name, position_x, position_y")
        .eq("hotel_id", hotelId).order("table_number"),
      supabase.from("floor_sections")
        .select("id, name, color")
        .eq("hotel_id", hotelId).order("sort_order"),
    ]);
    const rawTables = tablesRes.data || [];

    const cols = 6;
    const gap = 110;
    const offsetX = 30;
    const offsetY = 30;
    const needsPosition = rawTables.filter(t => (t.position_x ?? 0) === 0 && (t.position_y ?? 0) === 0);
    if (needsPosition.length > 1) {
      const sorted = [...rawTables].sort((a, b) => a.table_number - b.table_number);
      const updates: { id: string; position_x: number; position_y: number }[] = [];
      let idx = 0;
      const positioned = sorted.map(t => {
        if ((t.position_x ?? 0) === 0 && (t.position_y ?? 0) === 0) {
          const x = (idx % cols) * gap + offsetX;
          const y = Math.floor(idx / cols) * gap + offsetY;
          idx++;
          updates.push({ id: t.id, position_x: x, position_y: y });
          return { ...t, position_x: x, position_y: y };
        }
        idx++;
        return t;
      });
      setTables(positioned);
      void Promise.all(
        updates.map(u =>
          supabase.from("restaurant_tables")
            .update({ position_x: u.position_x, position_y: u.position_y })
            .eq("id", u.id),
        ),
      );
    } else {
      setTables(rawTables);
    }
    setSections(sectionsRes.data || []);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase
      .channel("layout-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `hotel_id=eq.${hotelId}` }, () => void fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, fetchData]);

  const filteredTables = activeSection === "All" ? tables : tables.filter(t => t.section_name === activeSection);
  const allSectionNames = ["All", ...new Set(sections.map(s => s.name)), ...new Set(tables.map(t => t.section_name))].filter((v, i, a) => a.indexOf(v) === i);

  const handlePointerDown = (e: React.PointerEvent, table: TableItem) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDraggingId(table.id);
    setDragOffset({
      x: e.clientX - rect.left - table.position_x,
      y: e.clientY - rect.top - table.position_y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width - 88, e.clientX - rect.left - dragOffset.x));
    const y = Math.max(0, Math.min(rect.height - 88, e.clientY - rect.top - dragOffset.y));
    setTables(prev => prev.map(t => t.id === draggingId ? { ...t, position_x: Math.round(x), position_y: Math.round(y) } : t));
  };

  const handlePointerUp = async () => {
    if (!draggingId) return;
    const table = tables.find(t => t.id === draggingId);
    if (table) {
      await supabase.from("restaurant_tables")
        .update({ position_x: table.position_x, position_y: table.position_y })
        .eq("id", table.id);
    }
    setDraggingId(null);
  };

  const addTable = async () => {
    if (!hotelId) return;
    const maxNum = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) : 0;
    const { error } = await supabase.from("restaurant_tables").insert({
      hotel_id: hotelId,
      table_number: maxNum + 1,
      capacity: Number(newCapacity) || 4,
      section_name: newSection || "Main",
      position_x: 50 + Math.random() * 300,
      position_y: 50 + Math.random() * 200,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Table ${maxNum + 1} added`);
    setAddOpen(false);
    await fetchData();
  };

  const deleteTable = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    await supabase.from("restaurant_tables").delete().eq("id", id);
    toast.success("Table deleted");
    await fetchData();
  };

  const addSection = async () => {
    if (!hotelId || !sectionName.trim()) return;
    const sortOrder = sections.length;
    const { error } = await supabase.from("floor_sections").insert({
      hotel_id: hotelId, name: sectionName.trim(), color: sectionColor, sort_order: sortOrder,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Section "${sectionName}" added`);
    setSectionOpen(false); setSectionName(""); setSectionColor("#F97316");
    await fetchData();
  };

  const resetPositions = async () => {
    if (!confirm("Reset all table positions to grid layout?")) return;
    const cols = 6;
    const gap = 120;
    for (let i = 0; i < tables.length; i++) {
      const x = (i % cols) * gap + 30;
      const y = Math.floor(i / cols) * gap + 30;
      await supabase.from("restaurant_tables").update({ position_x: x, position_y: y }).eq("id", tables[i].id);
    }
    toast.success("Positions reset");
    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-1 ring-primary/30">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">Floor Plan</h1>
            <p className="text-sm text-muted-foreground">Drag tables to arrange your floor plan — changes save automatically</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={resetPositions}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset Grid
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSectionOpen(true)}>
            <Layers className="h-4 w-4 mr-1" /> Add Section
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Table
          </Button>
        </div>
      </div>

      {/* Section chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {allSectionNames.map(name => {
          const active = activeSection === name;
          const count = name === "All" ? tables.length : tables.filter(t => t.section_name === name).length;
          return (
            <button
              key={name}
              onClick={() => setActiveSection(name)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {name}
              <span className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] ${
                active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground rounded-xl border border-border/60 bg-card px-4 py-2.5 w-fit">
        {[
          { label: "Available", color: "bg-table-empty" },
          { label: "Occupied", color: "bg-table-occupied" },
          { label: "Reserved", color: "bg-table-reserved" },
          { label: "Cleaning", color: "bg-table-cleaning" },
        ].map(s => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            {s.label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full rounded-2xl border border-border/60 bg-muted/10 overflow-hidden shadow-inner"
        style={{ minHeight: 500, height: "calc(100vh - 320px)" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.18] dark:opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(circle, hsl(var(--muted-foreground) / 0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        {filteredTables.map(table => {
          const border = statusBorder[table.status] || statusBorder.empty;
          const bg = statusBg[table.status] || statusBg.empty;
          const dot = statusDots[table.status] || statusDots.empty;
          const isDragging = draggingId === table.id;
          return (
            <motion.div
              key={table.id}
              className={`group absolute select-none rounded-2xl border-2 ${border} ${bg} bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-shadow ${
                isDragging ? "shadow-2xl shadow-primary/30 scale-105" : "shadow-sm hover:shadow-md"
              }`}
              style={{
                left: table.position_x,
                top: table.position_y,
                width: 92,
                height: 88,
                zIndex: isDragging ? 50 : 1,
              }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: isDragging ? 1.05 : 1, opacity: 1 }}
              onPointerDown={e => handlePointerDown(e, table)}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground/30 absolute top-1 left-1" />
              <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${dot} ring-2 ring-card`} />
              <span className="text-2xl font-bold text-foreground leading-none">{table.table_number}</span>
              <span className="text-[10px] text-muted-foreground mt-1">{table.capacity} seats</span>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground/80 mt-0.5">{table.status}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}

        {filteredTables.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MousePointer2 className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground">Drag tables to arrange your floor plan</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Table" above to get started.</p>
          </div>
        )}
      </div>

      {/* Add Table Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Table</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Capacity</label>
              <Input value={newCapacity} onChange={e => setNewCapacity(e.target.value)} type="number" min="1" placeholder="4" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Section</label>
              <Select value={newSection} onValueChange={setNewSection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Main", ...sections.map(s => s.name)].filter((v, i, a) => a.indexOf(v) === i).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addTable} className="w-full">Add Table</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={sectionOpen} onOpenChange={setSectionOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Floor Section</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Section Name</label>
              <Input value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="e.g. Terrace, Hall, Patio" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Color</label>
              <input type="color" value={sectionColor} onChange={e => setSectionColor(e.target.value)} className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
            <Button onClick={addSection} className="w-full">Create Section</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayoutDesigner;
