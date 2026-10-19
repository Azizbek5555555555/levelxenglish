"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressAudio, formatMb, needsCompression } from "@/lib/audio-compress";
import { IMAGE_MAX_INPUT_BYTES, IMAGE_TYPES, imageExtension, prepareImage } from "@/lib/image-prepare";
import { Button } from "@/components/ui/Button";
import { Alert, ProgressBar } from "@/components/ui/Card";

/** Ochiq bucket: Listening audiolari va rasmlar (faqat xodimlar yuklay oladi) */
const BUCKET = "audio";
/** Supabase bepul tarifidagi bitta fayl chegarasi */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type Status = "idle" | "working" | "done" | "error";

/**
 * Admin formasidagi "kompyuterdan yuklash" maydoni (audio yoki rasm).
 * Fayl tanlanishi bilan Supabase Storage'ga yuklanadi, manzili yashirin
 * maydonga yoziladi va forma "Saqlash" bosilganda shu manzil saqlanadi.
 */
export function UploadField({
  name,
  kind,
  defaultValue,
  folder,
}: {
  name: string;
  kind: "audio" | "image";
  defaultValue?: string | null;
  /** Storage ichidagi papka, masalan `tests/<id>` yoki `courses` */
  folder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue ?? "");
  // Sahifadagi boshqa joydan (masalan umumiy Listening audio) yangilansa — o'qituvchi
  // bu maydonga tegmagan bo'lsa, yangi qiymat olinadi (aks holda saqlashda eski bo'sh qiymat yozilib qolardi)
  const [touched, setTouched] = useState(false);
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (defaultValue !== prevDefault) {
    setPrevDefault(defaultValue);
    if (!touched) setUrl(defaultValue ?? "");
  }
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const busy = status === "working";

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
  }

  async function prepareAudio(file: File): Promise<Blob | null> {
    if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name)) {
      fail("Bu audio fayl emas. MP3 (yoki M4A/WAV) fayl tanlang.");
      return null;
    }
    if (!needsCompression(file)) return file;
    try {
      return await compressAudio(file, (fraction, step) => {
        setProgress(step === "decode" ? 5 : 5 + fraction * 85);
        setStage(step === "decode" ? `Audio o'qilmoqda (${formatMb(file.size)})…` : "Audio kichraytirilmoqda…");
      });
    } catch {
      fail("Audioni o'qib bo'lmadi. Fayl buzilmaganini tekshiring yoki Google Chrome'da urinib ko'ring.");
      return null;
    }
  }

  async function prepare(file: File): Promise<Blob | null> {
    if (kind === "audio") return prepareAudio(file);
    if (!IMAGE_TYPES.includes(file.type)) {
      fail("Rasm JPG, PNG, WEBP yoki GIF formatida bo'lsin.");
      return null;
    }
    if (file.size > IMAGE_MAX_INPUT_BYTES) {
      fail(`Rasm juda katta (${formatMb(file.size)}). 25 MB dan kichik rasm tanlang.`);
      return null;
    }
    setStage("Rasm tayyorlanmoqda…");
    try {
      return await prepareImage(file);
    } catch {
      fail("Rasmni o'qib bo'lmadi. Boshqa rasm tanlab ko'ring.");
      return null;
    }
  }

  async function handleFile(file: File) {
    setMessage(null);
    setProgress(3);
    setStatus("working");
    setStage(kind === "audio" ? "Audio tayyorlanmoqda…" : "Rasm tayyorlanmoqda…");

    const blob = await prepare(file);
    if (!blob) return;
    if (blob.size > MAX_UPLOAD_BYTES) {
      fail(`Fayl juda katta (${formatMb(blob.size)}). 50 MB dan kichik bo'lishi kerak.`);
      return;
    }

    setProgress(92);
    setStage(`Yuklanmoqda (${formatMb(blob.size)})… sahifani yopmang`);
    const type = kind === "audio" ? "audio/mpeg" : blob.type || file.type;
    const ext = kind === "audio" ? "mp3" : imageExtension(type);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (error) {
      fail(`Yuklab bo'lmadi: ${error.message}`);
      return;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    setTouched(true);
    setUrl(data.publicUrl);
    setProgress(100);
    setStatus("done");
    setMessage(
      `${kind === "audio" ? "Audio" : "Rasm"} yuklandi (${formatMb(blob.size)}). Endi pastdagi saqlash tugmasini bosing.`,
    );
  }

  function remove() {
    setTouched(true);
    setUrl("");
    setStatus("idle");
    setMessage("Olib tashlandi. O'zgarish saqlash tugmasini bosganda kuchga kiradi.");
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-line p-3">
      <input type="hidden" name={name} value={url} />

      {url ? (
        kind === "audio" ? (
          <audio src={url} controls preload="none" className="w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- admin oldindan ko'rishi, optimizatsiya shart emas
          <img src={url} alt="" className="max-h-56 rounded-lg border border-line object-contain" />
        )
      ) : (
        <p className="text-sm text-muted">{kind === "audio" ? "Hozircha audio yo'q." : "Hozircha rasm yo'q."}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={kind === "audio" ? "audio/*,.mp3,.m4a,.wav" : IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {kind === "audio" ? "🎧" : "🖼"} {url ? "Almashtirish" : "Kompyuterdan yuklash"}
        </Button>
        {url ? (
          <Button type="button" size="sm" variant="secondary" onClick={remove} disabled={busy}>
            🗑 Olib tashlash
          </Button>
        ) : null}
      </div>

      {busy ? (
        <div className="space-y-1.5" aria-live="polite">
          <p className="text-sm font-semibold">{stage}</p>
          <ProgressBar value={progress} showLabel />
        </div>
      ) : null}

      {message && !busy ? <Alert tone={status === "error" ? "danger" : "success"}>{message}</Alert> : null}
    </div>
  );
}
