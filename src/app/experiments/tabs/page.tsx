import type { Metadata } from "next";
import { ChromeTabs } from "./chrome-tabs";

export const metadata: Metadata = {
  title: "Chrome tabs · Experiments",
  description: "In-app tab strip that shrinks and grows the way Chrome's does.",
};

const NOTES = [
  "Tabs share the strip width: each one is clamped between 240px and 58px, so opening tabs shrinks them all and closing tabs grows them back.",
  "Once tabs hit their minimum width the strip scrolls instead of shrinking further.",
  "As a tab narrows it drops its close button, then its title, keeping the favicon last.",
  "Closing with the mouse pins the current width so the next close button lands under the cursor — it releases when the pointer leaves the strip.",
  "Middle-click closes a tab, same as Chrome.",
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl / ⌘ + T", "new tab"],
  ["Ctrl / ⌘ + W", "close the focused tab"],
  ["Alt + T / W", "same, without keyboard capture"],
  ["Alt + ← / →", "switch tabs"],
];

export default function TabsExperimentPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <div className="bg-amber-200 flex gap-5">
          {Array(5)
            .fill(null)
            .map((_, i) => (
              <div
                key={i}
                style={{ interpolateSize: "allow-keywords" }}
                className="bg-indigo-200 basis-60 min-w-9 whitespace-nowrap overflow-hidden"
              >
                New Tab
              </div>
            ))}
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Experiment
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Chrome tabs</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          An in-app tab strip that reproduces Chrome&apos;s sizing behaviour.
          Keep hitting <span className="font-medium">+</span> and watch the tabs
          shrink to fit the strip.
        </p>
      </header>

      <ChromeTabs />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">What it replicates</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {NOTES.map((note) => (
            <li key={note} className="flex gap-2">
              <span
                aria-hidden
                className="select-none text-muted-foreground/50"
              >
                &bull;
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Shortcuts</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="max-w-2xl text-xs text-muted-foreground">
          Browsers reserve <span className="font-medium">Ctrl+T</span> and{" "}
          <span className="font-medium">Ctrl+W</span> and never deliver them to
          a page, so they only reach this demo once it holds a keyboard lock.
          Hit the fullscreen button at the right of the fake toolbar to take one
          (Chromium only); long-press <kbd className="font-mono">Esc</kbd> to
          give it back. Outside that, use the Alt variants.
        </p>
      </section>
    </main>
  );
}
