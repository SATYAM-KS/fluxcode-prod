"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { togglePublishAction } from "@/app/(main)/admin/courses/actions";

interface TogglePublishButtonProps {
  courseId: string;
  initialPublished: boolean;
}

export function TogglePublishButton({
  courseId,
  initialPublished,
}: TogglePublishButtonProps) {
  const [published, setPublished] = useState(initialPublished);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    const next = !published;
    setPublished(next); // optimistic
    setLoading(true);

    const { error } = await togglePublishAction(courseId, next);

    if (error) {
      setPublished(!next); // revert
      toast.error("Failed to update status");
    } else {
      toast.success(next ? "Course published" : "Moved to draft");
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={published ? "Click to unpublish" : "Click to publish"}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${published
          ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
          : "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 dark:text-yellow-400"
        }`}
    >
      {published ? "Published" : "Draft"}
    </button>
  );
}
