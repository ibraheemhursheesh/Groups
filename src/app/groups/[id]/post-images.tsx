"use client";

export function PostImages({ images }: { images: string[] }) {
  if (images.length === 0) return null;

  const display = images.slice(0, 4);
  const remaining = images.length - 4;
  const cols = display.length === 1 ? 1 : 2;
  const rows = display.length <= 2 ? 1 : 2;

  return (
    <div
      className="grid gap-0.5 w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, auto)` }}
    >
      {display.map((src, i) => (
        <div key={i} className="relative">
          <img
            src={src}
            alt=""
            className="w-full object-cover"
            style={{ aspectRatio: cols === 1 ? "16/9" : "1/1", maxHeight: rows === 1 ? "400px" : "none" }}
          />
          {i === 3 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-lg font-bold text-white">+{remaining}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
