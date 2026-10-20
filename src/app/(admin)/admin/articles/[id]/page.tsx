import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArticleForAdmin } from "@/lib/admin-queries";
import {
  deleteArticleQuestionAction,
  upsertArticleAction,
  upsertArticleQuestionAction,
} from "@/lib/actions/admin";
import { topicMeta } from "@/lib/constants";
import { Badge, AccessBadge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Card";
import { AdminForm } from "@/components/admin/AdminForm";
import { Collapsible } from "@/components/admin/Collapsible";
import {
  articleFields,
  articleQuestionFields,
} from "@/components/admin/fieldSpecs";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const metadata: Metadata = {
  title: "Maqolani tahrirlash",
  robots: { index: false, follow: false },
};

export default async function AdminArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { article, questions } = await getArticleForAdmin(id);

  if (!article) notFound();

  const meta = topicMeta(article.topic);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/articles"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg"
      >
        ← Barcha maqolalar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold">{article.title}</h2>
            <Badge tone="brand">
              {meta.emoji} {meta.label}
            </Badge>
            <AccessBadge isPremium={article.is_premium} unlocked />
          </div>
          <p className="text-sm text-muted mt-1 font-mono">/{article.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/articles?new=1"
            className="rounded-lg border border-brand-400/50 bg-brand-400/10
                       px-3 py-2 text-sm font-semibold text-brand-400 hover:bg-brand-400/20 transition-colors"
          >
            ➕ Yangi maqola
          </Link>
          <Link
            href={`/boost/articles/${article.slug}`}
            className="rounded-lg border border-line bg-[var(--bg-subtle)]
                       px-3 py-2 text-sm font-semibold hover:border-brand-400 transition-colors"
          >
            👁 Saytda ko&apos;rish
          </Link>
        </div>
      </div>

      <Collapsible
        title="✏️ Maqolani tahrirlash"
        subtitle="Sarlavha, matn, yangi so'zlar"
      >
        <AdminForm
          action={upsertArticleAction}
          fields={articleFields(article as unknown as Record<string, unknown>)}
          submitLabel="Maqolani saqlash"
        />
      </Collapsible>

      <Collapsible
        title="➕ Reading savoli qo'shish"
        subtitle="True/False/Not Given · Multiple Choice · Gap Filling"
        tone="accent"
      >
        <AdminForm
          action={upsertArticleQuestionAction}
          fields={articleQuestionFields(article.id, { order_index: questions.length + 1 })}
          submitLabel="Savolni qo'shish"
          resetOnSuccess
        />
      </Collapsible>

      <section>
        <h3 className="font-bold mb-3">
          Savollar{" "}
          <span className="text-muted tabular-nums">({questions.length})</span>
        </h3>

        {questions.length === 0 ? (
          <Alert tone="info">
            Bu maqolada hali savol yo&apos;q. Savollar maqola oxirida
            ko&apos;rsatiladi.
          </Alert>
        ) : (
          <div className="space-y-2">
            {questions.map((question, i) => (
              <Collapsible
                key={question.id}
                title={`${i + 1}. ${truncate(question.prompt, 70)}`}
                subtitle={`${question.kind} · javob: ${formatAnswer(question.correct_answer)}`}
              >
                <div className="space-y-4">
                  <AdminForm
                    action={upsertArticleQuestionAction}
                    fields={articleQuestionFields(
                      article.id,
                      question as unknown as Record<string, unknown>,
                    )}
                    submitLabel="Savolni saqlash"
                  />

                  <form
                    action={deleteArticleQuestionAction}
                    className="pt-3 border-t border-line"
                  >
                    <input type="hidden" name="id" value={question.id} />
                    <input
                      type="hidden"
                      name="article_id"
                      value={article.id}
                    />
                    <ConfirmSubmitButton
                      message="Bu savolni o'chirasizmi?"
                      className="text-sm font-semibold text-danger hover:underline"
                    >
                      🗑 Bu savolni o&apos;chirish
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function truncate(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function formatAnswer(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value || "—";
  // ["colour","color"] → colour / color · {"1":"C","2":"A"} → 1→C, 2→A
  if (Array.isArray(value)) return value.map(String).join(" / ") || "—";
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}→${String(v)}`).join(", ") || "—";
  return String(value);
}
