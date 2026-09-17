"use client";

import { useMemo } from "react";
import katex from "katex";

// The booklet mixes Arabic prose with maths, so question text is stored as
// plain text with the maths wrapped in $...$ — e.g. "مجال الدالة $f(x)=\sqrt{x+1}$ هو".
// This splits on those markers and renders only the maths through KaTeX.
//
// Maths is always left-to-right even inside a right-to-left sentence, so each
// formula is isolated in its own inline-block with dir="ltr".
export function MathText({ text }: { text: string }) {
  const parts = useMemo(() => splitMath(text), [text]);

  return (
    <>
      {parts.map((part, i) =>
        part.math ? (
          <span
            key={i}
            dir="ltr"
            className="inline-block align-middle"
            // KaTeX returns a trusted HTML string built from our own seed data.
            dangerouslySetInnerHTML={{ __html: renderMath(part.value) }}
          />
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}

type Part = { math: boolean; value: string };

// Splits "abc $x^2$ def" into text/maths chunks. A trailing unmatched "$" is
// treated as literal text so a typo in one question can't blank the page.
function splitMath(text: string): Part[] {
  const parts: Part[] = [];
  let rest = text;

  while (rest.length > 0) {
    const start = rest.indexOf("$");
    if (start === -1) {
      parts.push({ math: false, value: rest });
      break;
    }
    const end = rest.indexOf("$", start + 1);
    if (end === -1) {
      parts.push({ math: false, value: rest });
      break;
    }
    if (start > 0) parts.push({ math: false, value: rest.slice(0, start) });
    parts.push({ math: true, value: rest.slice(start + 1, end) });
    rest = rest.slice(end + 1);
  }

  return parts;
}

function renderMath(value: string): string {
  try {
    return katex.renderToString(value, { throwOnError: false, displayMode: false });
  } catch {
    // Never let a malformed formula take down the quiz — show the raw source.
    return escapeHtml(value);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
