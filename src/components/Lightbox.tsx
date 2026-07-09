import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  images: { url: string; id: string }[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
};

export function Lightbox({ images, index, onClose, onChange }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onChange((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") onChange((index + 1) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, images.length, onClose, onChange]);

  if (images.length === 0) return null;
  const current = images[index];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
        aria-label="Fermer"
      >
        <X className="h-6 w-6" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange((index - 1 + images.length) % images.length);
            }}
            className={cn(
              "absolute left-4 text-white p-2 hover:bg-white/10 rounded-full",
            )}
            aria-label="Précédente"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange((index + 1) % images.length);
            }}
            className="absolute right-4 text-white p-2 hover:bg-white/10 rounded-full"
            aria-label="Suivante"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}
      <img
        src={current.url}
        alt=""
        className="max-h-[90vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
