"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveCourseAction } from "@/app/(main)/admin/courses/actions";

/* ─── Toggle switch ─────────────────────────────────────────────── */

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

/* ─── Field wrapper ─────────────────────────────────────────────── */

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/* ─── Types ─────────────────────────────────────────────────────── */

interface CourseFormProps {
  initialData?: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    price: number;
    is_published: boolean;
  };
}

/* ─── Form component ────────────────────────────────────────────── */

export function CourseForm({ initialData }: CourseFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(initialData?.thumbnail_url ?? "");
  const [price, setPrice] = useState(String(initialData?.price ?? "0"));
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? false);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  const showPreview =
    thumbnailUrl.trim().length > 0 &&
    (thumbnailUrl.startsWith("http://") || thumbnailUrl.startsWith("https://")) &&
    !imgError;

  async function handleSave(forcePublish?: boolean) {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    const publishState = forcePublish !== undefined ? forcePublish : isPublished;
    setSaving(true);

    const { error } = await saveCourseAction({
      ...(isEditing ? { id: initialData!.id } : {}),
      title: title.trim(),
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      price: Math.max(0, parseFloat(price) || 0),
      is_published: publishState,
    });

    setSaving(false);

    if (error) {
      toast.error(isEditing ? "Failed to update course" : "Failed to create course", {
        description: error,
      });
      return;
    }

    toast.success(isEditing ? "Course updated" : "Course created");
    router.push("/admin/courses");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title */}
      <Field label="Title" required>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Introduction to Next.js"
          disabled={saving}
          className={inputCls}
        />
      </Field>

      {/* Description */}
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What will students learn in this course?"
          rows={5}
          disabled={saving}
          className={cn(inputCls, "resize-y")}
        />
      </Field>

      {/* Thumbnail URL + live preview */}
      <Field label="Thumbnail URL">
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => {
            setThumbnailUrl(e.target.value);
            setImgError(false);
          }}
          placeholder="https://example.com/image.jpg"
          disabled={saving}
          className={inputCls}
        />
        {showPreview && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="aspect-video w-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}
        {imgError && thumbnailUrl.trim() && (
          <p className="mt-1 text-xs text-destructive">
            Could not load image — check the URL.
          </p>
        )}
      </Field>

      {/* Price */}
      <Field label="Price (INR)" hint="Set to 0 for a free course.">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            ₹
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={saving}
            className={cn(inputCls, "pl-7")}
          />
        </div>
      </Field>

      {/* Is Published toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-medium">Published</p>
          <p className="text-xs text-muted-foreground">
            {isPublished
              ? "Visible to all users on the courses page."
              : "Hidden from public. Only admins can see it."}
          </p>
        </div>
        <Toggle checked={isPublished} onChange={setIsPublished} disabled={saving} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/courses")}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saving}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save as Draft
        </Button>
        <Button type="button" onClick={() => handleSave(true)} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? "Save & Publish" : "Create & Publish"}
        </Button>
      </div>
    </div>
  );
}
