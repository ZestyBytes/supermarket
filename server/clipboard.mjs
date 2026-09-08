import { execFileSync } from "node:child_process";
import { platform } from "node:os";

/** Read the system clipboard, whatever the OS. */
export function readClipboard() {
  const os = platform();
  const big = { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 };

  if (os === "win32") {
    return execFileSync("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], big);
  }
  if (os === "darwin") return execFileSync("pbpaste", big);
  return execFileSync("sh", ["-c", "wl-paste 2>/dev/null || xclip -selection clipboard -o"], big);
}
