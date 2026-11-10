"use client";

import { FontFamily } from "@/components/CoverEditorModal";

/**
 * Loads fonts (TTF) installed on the server into the browser via @font-face
 * so the cover/subtitle live previews show the actual typeface.
 * Font files are served from the authenticated /api/fonts/file?path= (same origin, so the session cookie is sent automatically).
 */
export default function FontFaceLoader({ families }: { families: FontFamily[] }) {
  if (!families.length) return null;

  const url = (p: string) => `/api/fonts/file?path=${encodeURIComponent(p)}`;
  const css = families
    .map((f) => {
      const name = f.name.replace(/'/g, "");
      return [
        `@font-face{font-family:'${name}';src:url('${url(f.regular)}') format('truetype');font-weight:400;font-display:swap;}`,
        `@font-face{font-family:'${name}';src:url('${url(f.bold)}') format('truetype');font-weight:700;font-display:swap;}`,
      ].join("");
    })
    .join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
