"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PostImages({ images }: { images: string[] }) {
  const [carouselIndex, setCarouselIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const display = images.slice(0, 4);
  const remaining = images.length - 4;
  const cols = display.length === 1 ? 1 : 2;
  const rows = display.length <= 2 ? 1 : 2;

  const openCarousel = (index: number) => {
    if (index === 3 && remaining > 0) {
      setCarouselIndex(3);
    } else {
      setCarouselIndex(index);
    }
  };

  const prev = () => setCarouselIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  const next = () => setCarouselIndex((i) => (i !== null && i < images.length - 1 ? i + 1 : i));

  const close = () => setCarouselIndex(null);

  return (
    <>
      <div
        className="grid gap-0.5 w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        {display.map((src, i) => (
          <div
            key={i}
            className="relative cursor-pointer"
            style={{
              aspectRatio: cols === 1 ? "16 / 9" : "1 / 1",
              // maxHeight: rows === 1 ? "400px" : undefined,
            }}
            onClick={() => openCarousel(i)}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes={
                cols === 1
                  ? "(max-width: 768px) 100vw, 700px"
                  : "(max-width: 768px) 50vw, 350px"
              }
            />
            {i === 3 && remaining > 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                <span className="text-lg font-bold text-white">
                  +{remaining}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {carouselIndex !== null && (
        <Dialog
          open
          onOpenChange={(v) => {
            if (!v) close();
          }}
        >
          <DialogPortal>
            <DialogOverlay className="bg-black/80" />
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <button
                onClick={close}
                className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <span className="sr-only">Close</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

              <div className="flex items-center gap-4">
                <button
                  onClick={prev}
                  disabled={carouselIndex === 0}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                >
                  <ChevronLeft className="size-6" />
                </button>

                <div
                  className="relative"
                  style={{ width: "85vw", maxWidth: "1200px", height: "85vh" }}
                >
                  <Image
                    src={images[carouselIndex]}
                    alt=""
                    fill
                    className="rounded-lg object-contain"
                    sizes="85vw"
                  />
                </div>

                <button
                  onClick={next}
                  disabled={carouselIndex === images.length - 1}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30"
                >
                  <ChevronRight className="size-6" />
                </button>
              </div>

              <span className="absolute bottom-4 text-sm text-white/70">
                {carouselIndex + 1} / {images.length}
              </span>
            </div>
          </DialogPortal>
        </Dialog>
      )}
    </>
  );
}
