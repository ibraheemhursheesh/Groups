// UUID v4-shaped id built from `crypto.getRandomValues`, matching the ids the
// rest of the app generates inline.
export function newId(): string {
  return crypto
    .getRandomValues(new Uint8Array(16))
    .reduce(
      (s, b, i) =>
        s +
        (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
        b.toString(16).padStart(2, "0"),
      "",
    );
}
