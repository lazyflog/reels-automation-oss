"use client";

import { FontFamily } from "@/components/CoverEditorModal";

/**
 * 서버에 설치된 폰트(TTF)를 브라우저에 @font-face로 로드해
 * 표지·자막 라이브 미리보기에서 실제 글꼴이 보이도록 한다.
 * 폰트 파일은 인증된 /api/fonts/file?path= 로 서빙됨(동일 출처라 세션 쿠키 자동 전송).
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
