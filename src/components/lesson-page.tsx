"use client";

import { MathText } from "@/components/math-text";
import content from "@/data/lesson-content.json";

// Renders a booklet page as real web content: selectable Arabic text, KaTeX
// formulas, and tables that reflow on a phone — rather than a flat scan.

type Item = { text: string; en?: string };
type Block =
  | { type: "cover"; title: string; by: string }
  | { type: "h"; text: string; en?: string }
  | { type: "p"; text: string }
  | { type: "ol"; items: Item[]; title?: string }
  | { type: "table"; rows: string[]; title?: string; plain?: boolean; start?: number }
  | { type: "note"; text: string }
  | { type: "example"; title: string; lines: string[] }
  | { type: "blank"; text: string };

type PageContent = { title?: string; titleEn?: string; blocks: Block[] };

const PAGES = (content as { pages: Record<string, PageContent> }).pages;

export function hasContent(page: number) {
  return Boolean(PAGES[String(page)]);
}

export function LessonPageContent({ page }: { page: number }) {
  const data = PAGES[String(page)];
  if (!data) return null;

  return (
    <article className="space-y-4 text-slate-800">
      {data.title && (
        <header className="border-b border-slate-200 pb-2">
          <h3 className="text-center text-lg font-bold">{data.title}</h3>
          {data.titleEn && (
            <p className="text-center text-sm text-red-600">{data.titleEn}</p>
          )}
        </header>
      )}
      {data.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </article>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "cover":
      return (
        <div className="py-10 text-center">
          <h2 className="text-3xl font-extrabold text-red-600">{block.title}</h2>
          <p className="mt-6 text-lg text-blue-800">{block.by}</p>
        </div>
      );

    case "h":
      return (
        <div className="flex flex-wrap items-baseline gap-2 border-b-2 border-red-300 pb-1">
          <h4 className="font-bold text-red-700">
            <MathText text={block.text} />
          </h4>
          {block.en && <span className="text-sm text-blue-600">{block.en}</span>}
        </div>
      );

    case "p":
      return (
        <p className="leading-loose">
          <MathText text={block.text} />
        </p>
      );

    case "ol":
      return (
        <div>
          {block.title && (
            <p className="mb-1 font-semibold text-blue-800">{block.title}</p>
          )}
          <ol className="space-y-2">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-2 leading-loose">
                <span className="shrink-0 font-bold text-slate-500">{i + 1}-</span>
                <span>
                  <MathText text={it.text} />
                  {it.en && (
                    <span className="mr-2 text-sm text-red-500">{it.en}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "table":
      return (
        <div>
          {block.title && (
            <p className="mb-1 font-semibold text-blue-800">{block.title}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-400 text-slate-800">
              <tbody>
                {block.rows.map((r, i) => (
                  <tr key={i} className="border border-slate-300">
                    {!block.plain && (
                      <td className="w-12 border border-slate-300 bg-slate-50 p-2 text-center text-sm font-bold">
                        {(block.start ?? 1) + i}
                      </td>
                    )}
                    <td className="p-2 leading-loose">
                      <MathText text={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "note":
      return (
        <div className="rounded-lg border-r-4 border-blue-400 bg-blue-50 p-3">
          <p className="text-sm font-semibold text-blue-800">* ملاحظة :</p>
          <p className="mt-1 leading-loose">
            <MathText text={block.text} />
          </p>
        </div>
      );

    case "example":
      return (
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3">
          <p className="font-semibold text-slate-700 underline">{block.title}</p>
          <div className="mt-2 space-y-2">
            {block.lines.map((l, i) => (
              <p key={i} className="leading-loose">
                <MathText text={l} />
              </p>
            ))}
          </div>
        </div>
      );

    case "blank":
      return (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          {block.text}
        </p>
      );

    default:
      return null;
  }
}
