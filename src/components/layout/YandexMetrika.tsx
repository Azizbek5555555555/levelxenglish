"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Yandex Metrika hisoblagichi (metrika.yandex.ru → Sozlamalar) */
export const YANDEX_METRIKA_ID = 113671604;

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

/** Xodimlar sahifalari: o'quvchilar ma'lumoti Vebvizor yozuvlariga tushmasin */
const isPrivate = (path: string) => path.startsWith("/admin");

/** Yandex bergan rasmiy kod (faqat hisoblagich raqami konstantadan olinadi) */
const SNIPPET = `
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}', 'ym');

ym(${YANDEX_METRIKA_ID}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
`;

/**
 * Yandex Metrika: tashriflar statistikasi, Vebvizor va bosishlar xaritasi.
 * Faqat production'da ishlaydi (lokal `npm run dev` statistikani buzmasin).
 * Sayt sahifadan sahifaga qayta yuklanmasdan o'tadi, shuning uchun har bir
 * o'tishda Metrika'ga yangi sahifa ko'rilgani alohida xabar qilinadi.
 */
export function YandexMetrika({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  // Admin sahifasidan boshlab ochilgan bo'lsa, hisoblagich umuman yuklanmaydi
  const [enabled] = useState(() => process.env.NODE_ENV === "production" && !isPrivate(pathname));
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const url = window.location.href;
    // Birinchi sahifani `init` o'zi hisoblaydi
    if (lastUrl.current !== null && !isPrivate(pathname)) {
      window.ym?.(YANDEX_METRIKA_ID, "hit", url, { referer: lastUrl.current });
    }
    lastUrl.current = url;
  }, [enabled, pathname]);

  if (!enabled) return null;
  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive" nonce={nonce}>
        {SNIPPET}
      </Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- JavaScript o'chiq brauzerlar uchun hisoblagich piksel */}
          <img
            src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
