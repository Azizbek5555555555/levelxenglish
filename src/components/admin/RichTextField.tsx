"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/** Muharrirda qoladigan teglar (qolganlari olib tashlanadi, ichidagi matn saqlanadi) */
const KEEP = new Set([
  "P", "BR", "H2", "H3", "H4", "STRONG", "EM", "U", "S", "MARK", "SUB", "SUP",
  "UL", "OL", "LI", "BLOCKQUOTE", "HR", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG", "A",
]);
/** Bir xil ma'noli teglar bitta ko'rinishga keltiriladi */
const RENAME: Record<string, string> = { B: "STRONG", I: "EM", H1: "H2", DIV: "P", H5: "H4", H6: "H4" };
/** Ichidagi narsa bilan birga butunlay o'chiriladigan teglar */
const DROP = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD", "IFRAME", "OBJECT", "svg", "SVG", "XML"]);

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Oddiy matn → paragraflar (bo'sh qator = yangi paragraf, oddiy qator = qator ko'chishi) */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Word, Google Docs yoki saytdan nusxalangan HTML'ni tozalaydi: faqat sarlavha,
 * paragraf, qalin/kursiv, ro'yxat va jadval qoladi; rang, shrift va uslublar olib tashlanadi.
 * (Saytga chiqishdan oldin server ham alohida tozalaydi.)
 */
export function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = document.createElement("div");

  function walk(source: Node, target: Node) {
    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(child.textContent ?? ""));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const element = child as Element;
      const tag = RENAME[element.tagName] ?? element.tagName;
      if (DROP.has(element.tagName) || element.tagName.includes(":")) continue;
      if (KEEP.has(tag)) {
        const copy = document.createElement(tag);
        for (const attr of ["colspan", "rowspan"]) {
          const value = element.getAttribute(attr);
          if (value && /^\d{1,2}$/.test(value)) copy.setAttribute(attr, value);
        }
        // Rasm va havolalar faqat xavfsiz manzil bilan qoladi
        if (tag === "IMG") {
          const src = element.getAttribute("src") ?? "";
          if (!/^https:\/\//i.test(src)) continue;
          copy.setAttribute("src", src);
          copy.setAttribute("alt", element.getAttribute("alt") ?? "");
        }
        if (tag === "A") {
          const href = element.getAttribute("href") ?? "";
          if (/^https?:\/\//i.test(href)) copy.setAttribute("href", href);
        }
        walk(element, copy);
        target.appendChild(copy);
      } else {
        walk(element, target); // tegni olib tashlab, ichini saqlaymiz
      }
    }
  }

  walk(doc.body, out);
  // Bo'sh paragraflar ("<p></p>", "<p><br></p>") olib tashlanadi
  out.querySelectorAll("p").forEach((p) => {
    if (!p.textContent?.trim() && !p.querySelector("br, hr")) p.remove();
  });
  return out.innerHTML.trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

const TOOLS: { label: string; title: string; run: () => void }[] = [
  { label: "Sarlavha", title: "Sarlavha qilish", run: () => document.execCommand("formatBlock", false, "<h2>") },
  { label: "Matn", title: "Oddiy matn (paragraf)", run: () => document.execCommand("formatBlock", false, "<p>") },
  { label: "B", title: "Qalin (Ctrl+B)", run: () => document.execCommand("bold") },
  { label: "I", title: "Kursiv (Ctrl+I)", run: () => document.execCommand("italic") },
  { label: "U", title: "Tagiga chizish (Ctrl+U)", run: () => document.execCommand("underline") },
  { label: "• Ro'yxat", title: "Belgili ro'yxat", run: () => document.execCommand("insertUnorderedList") },
  { label: "1. Ro'yxat", title: "Raqamli ro'yxat", run: () => document.execCommand("insertOrderedList") },
  { label: "Tozalash", title: "Belgilangan joyning formatini olib tashlash", run: () => document.execCommand("removeFormat") },
];

/**
 * Word'dagidek matn muharriri: o'qituvchi HTML bilmasdan matn yozadi yoki
 * Word / Google Docs'dan nusxalab qo'yadi. Natija yashirin maydonga HTML bo'lib yoziladi.
 */
export function RichTextField({
  name,
  defaultValue,
  placeholder,
  minHeight = 240,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initial = defaultValue ? (looksLikeHtml(defaultValue) ? defaultValue : textToHtml(defaultValue)) : "";
  const [html, setHtml] = useState(initial);
  const [empty, setEmpty] = useState(!initial);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = initial ? cleanHtml(initial) : "";
    setHtml(editor.innerHTML);
    // faqat birinchi ochilganda — keyin matnni o'qituvchi boshqaradi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    const editor = editorRef.current;
    if (!editor) return;
    const hasText = Boolean(editor.textContent?.trim()) || Boolean(editor.querySelector("img, hr, table"));
    setEmpty(!hasText);
    setHtml(hasText ? editor.innerHTML : "");
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const pastedHtml = event.clipboardData.getData("text/html");
    const pastedText = event.clipboardData.getData("text/plain");
    const insert = pastedHtml ? cleanHtml(pastedHtml) : textToHtml(pastedText);
    if (insert) document.execCommand("insertHTML", false, insert);
    sync();
  }

  return (
    <div className="rounded-xl border border-line bg-[var(--bg-subtle)] focus-within:border-brand-400">
      <input type="hidden" name={name} value={html} />
      <div className="flex flex-wrap gap-1 border-b border-line p-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            onMouseDown={(e) => {
              e.preventDefault(); // belgilangan matn yo'qolmasin
              editorRef.current?.focus();
              document.execCommand("defaultParagraphSeparator", false, "p");
              tool.run();
              sync();
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold text-muted hover:bg-[var(--bg-hover,rgba(127,127,127,.12))] hover:text-fg",
              tool.label === "B" && "font-black",
              tool.label === "I" && "italic",
              tool.label === "U" && "underline",
            )}
          >
            {tool.label}
          </button>
        ))}
      </div>
      <div className="relative">
        {empty && placeholder ? (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-muted">{placeholder}</p>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          onFocus={() => document.execCommand("defaultParagraphSeparator", false, "p")}
          onInput={sync}
          onBlur={sync}
          onPaste={onPaste}
          style={{ minHeight }}
          className={cn(
            "max-h-[70vh] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none",
            "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:font-bold",
            "[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6",
            "[&_table]:mb-3 [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2",
          )}
        />
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[11px] text-muted">
        Matnni shu yerga yozing yoki Word / Google Docs&apos;dan nusxalab qo&apos;ying. Bo&apos;sh qator — yangi xatboshi.
      </p>
    </div>
  );
}
