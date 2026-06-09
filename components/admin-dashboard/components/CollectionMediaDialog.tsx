"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { API_BASE } from "../utils";
import type { CollectionMedia } from "@/types/product";

export type CollectionMediaDraftItem = CollectionMedia & {
  origin: "existing" | "uploaded";
};

type CollectionMediaDialogProps = {
  open: boolean;
  value: CollectionMediaDraftItem[];
  request: (url: string, options?: RequestInit) => Promise<Response>;
  onOpenChange: (open: boolean) => void;
  onConfirm: (media: CollectionMediaDraftItem[]) => void;
};

const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;

const readResponseMessage = async (response: Response, fallback: string) => {
  try {
    const text = await response.clone().text();
    if (!text.trim()) {
      return response.statusText || fallback;
    }

    try {
      const data = JSON.parse(text);
      if (typeof data?.message === "string" && data.message.trim()) {
        return data.message;
      }
    } catch {
      return text.trim();
    }
  } catch {
    // Fall through to the fallback message below.
  }

  return response.statusText || fallback;
};

const inferKind = (file: File) => (file.type?.startsWith("video/") ? "VIDEO" : "IMAGE");

function CollectionMediaPreview({ item }: { item: CollectionMediaDraftItem }) {
  const isVideo = item.kind === "VIDEO";

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/70 bg-white shadow-none">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/20">
        {isVideo ? (
          <video
            src={item.url}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url("${encodeURI(item.url)}")` }}
          />
        )}
        <div className="absolute left-3 top-3">
          <Badge className={cn("rounded-full border-border/60 bg-white/90 text-foreground shadow-none")}>
            {isVideo ? "Video" : "Image"}
          </Badge>
        </div>
      </div>
      <div className="space-y-1 px-3 py-2">
        <p className="truncate text-sm font-medium text-foreground">{item.fileName || item.alt || "Untitled asset"}</p>
        <p className="truncate text-xs text-muted-foreground">{item.mimeType || item.storageKey}</p>
      </div>
    </div>
  );
}

export function CollectionMediaDialog({
  open,
  value,
  request,
  onOpenChange,
  onConfirm,
}: CollectionMediaDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeReasonRef = useRef<"confirm" | "cancel" | null>(null);
  const draftRef = useRef<CollectionMediaDraftItem[]>([]);
  const [draft, setDraft] = useState<CollectionMediaDraftItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const deleteRemoteAsset = useCallback(
    async (storageKey: string) => {
      try {
        await request(`${API_BASE}/uploads/${encodeURIComponent(storageKey)}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.error(error);
      }
    },
    [request]
  );

  useEffect(() => {
    if (!open) {
      if (closeReasonRef.current !== "confirm") {
        const uploadedStorageKeys = draftRef.current
          .filter((item) => item.origin === "uploaded")
          .map((item) => item.storageKey)
          .filter(Boolean);

        if (uploadedStorageKeys.length) {
          void Promise.allSettled(uploadedStorageKeys.map((storageKey) => deleteRemoteAsset(storageKey)));
        }
      }

      closeReasonRef.current = null;
      setDraft([]);
      setUploading(false);
      setSubmitting(false);
      return;
    }

    setDraft(value.map((item) => ({ ...item })));
  }, [deleteRemoteAsset, open, value]);

  const imageCount = useMemo(() => draft.filter((item) => item.kind === "IMAGE").length, [draft]);
  const videoCount = useMemo(() => draft.filter((item) => item.kind === "VIDEO").length, [draft]);
  const remainingImageSlots = Math.max(0, MAX_IMAGES - imageCount);
  const remainingVideoSlots = Math.max(0, MAX_VIDEOS - videoCount);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", inferKind(file));

    const response = await request(`${API_BASE}/uploads`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readResponseMessage(response, "Upload failed"));
    }

    const body = (await response.json().catch(() => null)) as
      | (Partial<CollectionMediaDraftItem> & { originalName?: string })
      | null;
    if (!body?.url || !body.storageKey) {
      throw new Error("Upload failed");
    }

    return body;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const acceptedFiles: File[] = [];
    let imageSlots = remainingImageSlots;
    let videoSlots = remainingVideoSlots;

    for (const file of files) {
      const kind = inferKind(file);
      if (kind === "IMAGE" && imageSlots > 0) {
        acceptedFiles.push(file);
        imageSlots -= 1;
      } else if (kind === "VIDEO" && videoSlots > 0) {
        acceptedFiles.push(file);
        videoSlots -= 1;
      }
    }

    const skippedCount = files.length - acceptedFiles.length;
    if (skippedCount > 0) {
      toast.warning(
        skippedCount === 1
          ? "One file was skipped because the collection media limit was reached."
          : `${skippedCount} files were skipped because the collection media limit was reached.`
      );
    }

    if (!acceptedFiles.length) {
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.allSettled(acceptedFiles.map((file) => uploadFile(file)));
      const nextItems = uploaded
        .filter((result): result is PromiseFulfilledResult<Partial<CollectionMediaDraftItem> & { originalName?: string }> =>
          result.status === "fulfilled"
        )
        .map((result) => result.value)
        .filter(
          (item): item is Partial<CollectionMediaDraftItem> & { originalName?: string } =>
            Boolean(item?.url && item?.storageKey)
        )
        .map((item) => ({
          id: item.id || crypto.randomUUID(),
          collectionId: item.collectionId,
          kind: item.kind || (String(item.mimeType || "").startsWith("video/") ? "VIDEO" : "IMAGE"),
          url: item.url!,
          storageKey: item.storageKey!,
          mimeType: item.mimeType ?? null,
          fileName: item.fileName ?? item.originalName ?? null,
          size: item.size ?? null,
          alt: item.alt ?? null,
          sortOrder: item.sortOrder ?? 0,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          origin: "uploaded" as const,
        }));

      const failedCount = uploaded.filter((result) => result.status === "rejected").length;
      if (failedCount > 0) {
        toast.error(
          failedCount === 1
            ? "One file could not be uploaded."
            : `${failedCount} files could not be uploaded.`
        );
      }

      if (nextItems.length) {
        setDraft((current) => [
          ...current,
          ...nextItems.map((item, index) => ({
            ...item,
            sortOrder: current.length + index,
          })),
        ]);
        toast.success("Media added");
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to upload media");
    } finally {
      setUploading(false);
    }
  };

  const cancelWithCleanup = useCallback(() => {
    closeReasonRef.current = "cancel";
    onOpenChange(false);
  }, [onOpenChange]);

  const removeItem = (item: CollectionMediaDraftItem) => {
    setDraft((current) => current.filter((entry) => entry.id !== item.id));
    if (item.origin === "uploaded") {
      void deleteRemoteAsset(item.storageKey);
    }
  };

  const confirm = async () => {
    if (submitting || uploading) {
      return;
    }

    setSubmitting(true);
    try {
      closeReasonRef.current = "confirm";
      const nextMedia = draftRef.current.map((item) => ({ ...item, origin: "existing" as const }));
      await Promise.resolve(onConfirm(nextMedia));
      onOpenChange(false);
      toast.success("Media added to collection");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Unable to add media");
      closeReasonRef.current = null;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }

        if (closeReasonRef.current === "confirm") {
          onOpenChange(false);
          return;
        }

        cancelWithCleanup();
      }}
    >
      <DialogContent
        overlayClassName="z-[60] bg-black/45 backdrop-blur-[2px]"
        className="z-[70] w-[min(56rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-[28px] border-border/60 bg-white p-0 shadow-none"
      >
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b border-border/60 px-6 py-5 text-left">
            <DialogTitle className="text-xl font-semibold text-foreground">Add media</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Upload up to 5 images and 1 video for this collection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
              <Badge variant="secondary" className="rounded-full">
                {imageCount}/{MAX_IMAGES} images
              </Badge>
              <Badge variant="secondary" className="rounded-full">
                {videoCount}/{MAX_VIDEOS} video
              </Badge>
              <span>Supported files: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV.</span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              disabled={uploading}
            >
              <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-white text-primary shadow-none">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {uploading ? "Uploading media..." : "Click to add files"}
                </p>
                <p className="text-sm text-muted-foreground">Images become the cover artwork. Video is optional.</p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="min-h-0 flex-1 border-t border-border/60 bg-muted/10">
            {draft.length ? (
              <ScrollArea className="h-[min(52vh,34rem)]">
                <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
                  {draft.map((item) => (
                    <div key={item.id} className="relative">
                      <CollectionMediaPreview item={item} />
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full border border-border/70 bg-white/95 text-foreground shadow-none transition hover:bg-white"
                        aria-label={`Remove ${item.fileName || item.alt || "media"}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex min-h-[18rem] flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-border/70 bg-white text-muted-foreground shadow-none">
                  <ImagePlus className="h-7 w-7" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">No media added yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add images for the gallery and one video if you want a richer collection story.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="relative z-[1] border-t border-border/60 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="pointer-events-auto rounded-full border-border/70 bg-white px-5 shadow-none hover:bg-muted/40"
              onClick={cancelWithCleanup}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="pointer-events-auto rounded-full bg-[#111111] px-6 text-white shadow-none hover:bg-black"
              onClick={() => {
                void confirm();
              }}
              disabled={submitting || uploading}
            >
              {submitting ? "Saving..." : "Add media"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
