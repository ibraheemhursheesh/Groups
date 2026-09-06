/**
 * Copy text to the clipboard, returning whether it worked.
 *
 * The async Clipboard API only exists in a secure context (https or localhost),
 * so it is missing when the app is opened over plain http on a LAN IP — a common
 * way to test on a phone. In that case we fall back to a hidden textarea plus the
 * deprecated `execCommand("copy")`, which still works in that setting.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path (e.g. permission denied).
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    // Keep it off-screen and non-scrolling so the page does not jump.
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
