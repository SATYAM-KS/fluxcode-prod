"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  BookOpen,
  PlayCircle,
  Video,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */

type Lesson = {
  id: string;
  title: string;
  description?: string | null;
  drive_video_url?: string | null;
  duration?: number | null;
  is_free_preview?: boolean;
  order_index: number;
};

type Section = {
  id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
};

/* ─── Helpers ───────────────────────────────────────────────────── */

function parseDurationToSeconds(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
  return null;
}

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toYouTubeEmbedUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // youtu.be short links
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
    }
    // youtube.com/watch?v=...
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
      }
      if (u.pathname.startsWith("/embed/")) return raw;
    }
    return null; // not a YouTube URL, no preview
  } catch {
    return null;
  }
}

/* ─── Toggle ────────────────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        checked ? "bg-primary" : "bg-input"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* ─── Lesson Editor (slide-over) ────────────────────────────────── */

function LessonEditor({
  mode,
  initial,
  onClose,
  onSaved,
  sectionId,
  nextOrderIndex,
}: {
  mode: "create" | "edit";
  initial?: Lesson;
  sectionId: string;
  nextOrderIndex: number;
  onClose: () => void;
  onSaved: (lesson: Lesson) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [driveUrl, setDriveUrl] = useState(initial?.drive_video_url ?? "");
  const [durationText, setDurationText] = useState(
    initial?.duration != null && initial.duration > 0 ? formatSeconds(initial.duration) : ""
  );
  const [freePreview, setFreePreview] = useState(!!initial?.is_free_preview);
  const [saving, setSaving] = useState(false);

  const embedUrl = useMemo(() => toYouTubeEmbedUrl(driveUrl) ?? null, [driveUrl]);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Lesson title is required");
      return;
    }
    const durationSeconds = durationText.trim() ? parseDurationToSeconds(durationText) : null;
    if (durationText.trim() && durationSeconds == null) {
      toast.error("Invalid duration", { description: "Use mm:ss or hh:mm:ss" });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = {
      section_id: sectionId,
      title: trimmed,
      description: description.trim() || null,
      drive_video_url: driveUrl.trim() || null,
      duration: durationSeconds,
      is_free_preview: freePreview,
      order_index: mode === "create" ? nextOrderIndex : initial!.order_index,
    };

    const result =
      mode === "create"
        ? await supabase.from("lessons").insert(payload).select("*").single()
        : await supabase
          .from("lessons")
          .update(payload)
          .eq("id", initial!.id)
          .select("*")
          .single();
    setSaving(false);

    if (result.error || !result.data) {
      toast.error("Failed to save lesson", { description: result.error?.message });
      return;
    }

    const saved = result.data as any;
    onSaved({
      id: saved.id,
      title: saved.title,
      description: saved.description,
      drive_video_url: saved.drive_video_url,
      duration: saved.duration,
      is_free_preview: saved.is_free_preview,
      order_index: saved.order_index,
    });
    toast.success(mode === "create" ? "Lesson added" : "Lesson updated");
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div>
            <p className="text-sm font-semibold">{mode === "create" ? "Add Lesson" : "Edit Lesson"}</p>
            <p className="text-xs text-muted-foreground">Section content</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lesson Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              rows={3}
              placeholder="Optional lesson description..."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">YouTube Video URL</label>
            <input
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              disabled={saving}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            />
            <p className="text-xs text-muted-foreground">Paste the YouTube video URL (unlisted or public)</p>
          </div>

          {embedUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="overflow-hidden rounded-lg border border-border">
                <iframe
                  title="YouTube video preview"
                  src={embedUrl}
                  className="aspect-video w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Duration</label>
              <input
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                disabled={saving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="12:34"
              />
            </div>
            <div className="flex items-end justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Free Preview</p>
                <p className="text-[11px] text-muted-foreground">Public lesson</p>
              </div>
              <Toggle checked={freePreview} onChange={setFreePreview} disabled={saving} />
            </div>
          </div>

        </div>
        </div>
        <div className="shrink-0 flex justify-end gap-2 border-t border-border bg-card px-4 py-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
      </div>
    </>
  );
}

/* ─── Sortable Lesson Row ───────────────────────────────────────── */

function SortableLessonRow({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: Lesson;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm",
        isDragging && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder lesson"
        className="cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{lesson.title}</span>
          {!!lesson.is_free_preview && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              Free
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Video className={cn("h-3.5 w-3.5", lesson.drive_video_url ? "" : "opacity-30")} />
          {lesson.drive_video_url ? "Video" : "No link"}
        </span>
        {lesson.duration != null && lesson.duration > 0 && (
          <span>{formatSeconds(lesson.duration)}</span>
        )}
      </div>

      <div className="ml-2 flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit lesson</span>
        </Button>
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                onDelete();
                setConfirming(false);
              }}
              className="text-destructive hover:text-destructive/70"
              aria-label="Confirm delete lesson"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cancel delete lesson"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete lesson</span>
          </Button>
        )}
      </div>
    </li>
  );
}

/* ─── Lessons Manager ───────────────────────────────────────────── */

function LessonsManager({ section }: { section: Section }) {
  const [lessons, setLessons] = useState<Lesson[]>(
    [...(section.lessons ?? [])].sort((a, b) => a.order_index - b.order_index)
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIndex, newIndex);
    const previous = lessons;
    setLessons(reordered);

    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((lesson, index) =>
        supabase.from("lessons").update({ order_index: index }).eq("id", lesson.id)
      )
    );
    if (results.some((r) => r.error)) {
      setLessons(previous);
      toast.error("Failed to save lesson order");
    } else {
      toast.success("Lesson order saved");
    }
  }

  async function deleteLesson(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete lesson");
      return;
    }
    setLessons((prev) => prev.filter((l) => l.id !== id));
    toast.success("Lesson deleted");
  }

  function upsertLesson(saved: Lesson) {
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === saved.id);
      if (idx === -1) return [...prev, saved].sort((a, b) => a.order_index - b.order_index);
      const next = [...prev];
      next[idx] = saved;
      return next.sort((a, b) => a.order_index - b.order_index);
    });
  }

  return (
    <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Lessons
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditingLesson(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Lesson
        </Button>
      </div>

      {lessons.length === 0 ? (
        <p className="text-xs text-muted-foreground">No lessons in this section yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLessonDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={lessons.map((l) => l.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {lessons.map((lesson) => (
                <SortableLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  onEdit={() => {
                    setEditingLesson(lesson);
                    setEditorOpen(true);
                  }}
                  onDelete={() => deleteLesson(lesson.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {editorOpen && (
        <LessonEditor
          mode={editingLesson ? "edit" : "create"}
          initial={editingLesson ?? undefined}
          sectionId={section.id}
          nextOrderIndex={lessons.length}
          onClose={() => setEditorOpen(false)}
          onSaved={upsertLesson}
        />
      )}
    </div>
  );
}

/* ─── Sortable Section ──────────────────────────────────────────── */

interface SortableSectionProps {
  section: Section;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function SortableSection({
  section,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: SortableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(section.title);
  const [confirming, setConfirming] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);

  async function saveTitle() {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    if (trimmed === section.title) {
      setEditing(false);
      return;
    }
    setSavingTitle(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("sections")
      .update({ title: trimmed })
      .eq("id", section.id);
    setSavingTitle(false);
    if (error) {
      toast.error("Failed to save section title");
    } else {
      onUpdate(section.id, trimmed);
      setEditing(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue(section.title);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border bg-card transition-shadow",
        isDragging && "z-50 opacity-50 shadow-2xl"
      )}
    >
      {/* Header row */}
      <div className="flex min-h-[46px] items-center gap-1.5 px-3 py-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="cursor-grab touch-none text-muted-foreground/30 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand / collapse */}
        <button
          onClick={onToggle}
          aria-label={expanded ? "Collapse section" : "Expand section"}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Title — edit mode or display mode */}
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") cancelEdit();
              }}
              disabled={savingTitle}
              className="h-7 flex-1 rounded border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <button
              onClick={saveTitle}
              disabled={savingTitle}
              aria-label="Save title"
              className="shrink-0 text-green-600 hover:text-green-500 disabled:opacity-50 dark:text-green-400"
            >
              {savingTitle ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={cancelEdit}
              aria-label="Cancel edit"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Clickable title */}
            <button
              onClick={() => {
                setEditValue(section.title);
                setEditing(true);
              }}
              title="Click to edit"
              className="flex-1 text-left text-sm font-medium hover:text-primary"
            >
              {section.title}
            </button>

            {/* Lesson count */}
            <span className="shrink-0 text-xs text-muted-foreground">
              {section.lessons.length} lesson
              {section.lessons.length !== 1 ? "s" : ""}
            </span>

            {/* Delete / inline confirm */}
            {confirming ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <button
                  onClick={() => {
                    onDelete(section.id);
                    setConfirming(false);
                  }}
                  aria-label="Confirm delete"
                  className="text-destructive hover:text-destructive/70"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  aria-label="Cancel delete"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                aria-label="Delete section"
                className="shrink-0 text-muted-foreground/40 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Accordion: lessons manager */}
      {expanded && <LessonsManager section={section} />}
    </div>
  );
}

/* ─── Sections Manager ──────────────────────────────────────────── */

interface SectionsManagerProps {
  courseId: string;
  initialSections: Section[];
}

export function SectionsManager({
  courseId,
  initialSections,
}: SectionsManagerProps) {
  const [sections, setSections] = useState<Section[]>(
    [...initialSections].sort((a, b) => a.order_index - b.order_index)
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingSection, setAddingSection] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    const previous = sections;

    setSections(reordered); // optimistic

    const supabase = createClient();
    const results = await Promise.all(
      reordered.map((section, index) =>
        supabase
          .from("sections")
          .update({ order_index: index })
          .eq("id", section.id)
      )
    );

    if (results.some((r) => r.error)) {
      setSections(previous); // revert
      toast.error("Failed to save new order");
    } else {
      toast.success("Order saved");
    }
  }

  async function handleAddSection() {
    if (!newTitle.trim()) return;
    setAddingSaving(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("sections")
      .insert({
        course_id: courseId,
        title: newTitle.trim(),
        order_index: sections.length,
      })
      .select("id, title, order_index")
      .single();

    setAddingSaving(false);

    if (error || !data) {
      toast.error("Failed to add section");
      return;
    }

    setSections((prev) => [...prev, { ...data, lessons: [] }]);
    setNewTitle("");
    setAddingSection(false);
    toast.success("Section added");
  }

  async function handleDeleteSection(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("sections").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete section");
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success("Section deleted");
  }

  function handleUpdateSection(id: string, title: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sections</h2>
          <p className="text-xs text-muted-foreground">
            Drag to reorder &middot; click title to edit
          </p>
        </div>
        {!addingSection && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddingSection(true)}
          >
            <Plus className="h-4 w-4" />
            Add Section
          </Button>
        )}
      </div>

      {/* Inline add form */}
      {addingSection && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-muted/20 px-3 py-2.5">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSection();
              if (e.key === "Escape") {
                setAddingSection(false);
                setNewTitle("");
              }
            }}
            placeholder="Section title…"
            disabled={addingSaving}
            className="flex-1 rounded border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button
            size="sm"
            onClick={handleAddSection}
            disabled={addingSaving || !newTitle.trim()}
          >
            {addingSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAddingSection(false);
              setNewTitle("");
            }}
            disabled={addingSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && !addingSection && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <BookOpen className="mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium">No sections yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add sections to organize your course content.
          </p>
        </div>
      )}

      {/* Sortable list */}
      {sections.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sections.map((section) => (
                <SortableSection
                  key={section.id}
                  section={section}
                  expanded={expandedIds.has(section.id)}
                  onToggle={() => toggleExpanded(section.id)}
                  onUpdate={handleUpdateSection}
                  onDelete={handleDeleteSection}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
