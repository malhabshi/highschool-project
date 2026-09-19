#!/usr/bin/env node
// Build the exam as a real PDF file, without needing the site or a login.
// Reads the same JSON the app does, renders it with KaTeX, and prints it
// through headless Chrome.
//
//   node scripts/export-pdf.mjs                 # teacher copy (default)
//   node scripts/export-pdf.mjs --mode blank    # question paper to hand out
//   node scripts/export-pdf.mjs --out ~/x.pdf
//
// Needs Google Chrome installed; puppeteer-core is already a dependency.
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdtempSync,
  readdirSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";
import puppeteer from "puppeteer-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const mode = argOf("--mode", "solved");
// original = the booklet's own scanned pages, exactly as uploaded
// web      = the transcribed HTML version
const style = argOf("--style", "original");
const srcPdf = argOf(
  "--pdf",
  resolve(process.env.HOME ?? "", "Downloads/مذكرة القدرات new 2.pdf")
);
if (!["solved", "blank"].includes(mode)) {
  console.error(`Unknown --mode "${mode}". Use solved or blank.`);
  process.exit(1);
}
const outPath = resolve(
  process.cwd(),
  argOf("--out", mode === "solved" ? "teacher-copy.pdf" : "question-paper.pdf")
);

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find(existsSync);
if (!CHROME) {
  console.error("Google Chrome not found — install it, or edit CHROME in this script.");
  process.exit(1);
}

// ── the booklet's own pages, rendered straight from the source PDF ──
function bookletPages() {
  if (!existsSync(srcPdf)) {
    console.error(
      `Source booklet not found at:\n  ${srcPdf}\n` +
        `Pass it with --pdf "/path/to/booklet.pdf", or use --style web.`
    );
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), "booklet-"));
  // 150dpi keeps the scan legible without making the file unwieldy.
  execFileSync("pdftoppm", ["-r", "150", "-jpeg", "-jpegopt", "quality=82", srcPdf, join(dir, "p")]);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => ({
      page: parseInt(f.match(/(\d+)\.jpg$/)[1], 10),
      file: join(dir, f),
    }));
}

const { questions } = read("src/data/quiz-questions.json");
const { steps: SOLUTIONS } = read("src/data/solutions.json");
const { lessons: LESSONS } = read("src/data/lessons.json");
const { pages: CONTENT } = read("src/data/lesson-content.json");
const LETTERS = ["a", "b", "c", "d"];
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Same convention as the site: maths is wrapped in $...$ and stays left-to-right
// inside the right-to-left Arabic around it.
function mathText(text) {
  const parts = String(text).split("$");
  let out = "";
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      try {
        out += `<span dir="ltr" class="m">${katex.renderToString(part, {
          throwOnError: false,
        })}</span>`;
      } catch {
        out += esc(part);
      }
    } else out += esc(part);
  });
  return out;
}

// ── lesson pages, rendered from the transcription ──
function block(b) {
  switch (b.type) {
    case "cover":
      return `<div class="cover"><h2>${esc(b.title)}</h2><p>${esc(b.by)}</p></div>`;
    case "h":
      return `<h4 class="bh">${mathText(b.text)}${
        b.en ? `<span class="en">${esc(b.en)}</span>` : ""
      }</h4>`;
    case "p":
      return `<p>${mathText(b.text)}</p>`;
    case "ol":
      return `${b.title ? `<p class="sub">${esc(b.title)}</p>` : ""}<ol>${b.items
        .map(
          (it) =>
            `<li>${mathText(it.text)}${
              it.en ? `<span class="en">${esc(it.en)}</span>` : ""
            }</li>`
        )
        .join("")}</ol>`;
    case "table":
      return `${b.title ? `<p class="sub">${esc(b.title)}</p>` : ""}<table>${b.rows
        .map(
          (r, i) =>
            `<tr>${
              b.plain ? "" : `<td class="num">${(b.start ?? 1) + i}</td>`
            }<td>${mathText(r)}</td></tr>`
        )
        .join("")}</table>`;
    case "note":
      return `<div class="note"><b>* ملاحظة :</b> ${mathText(b.text)}</div>`;
    case "example":
      return `<div class="ex"><b>${esc(b.title)}</b>${b.lines
        .map((l) => `<p>${mathText(l)}</p>`)
        .join("")}</div>`;
    case "blank":
      return `<p class="blank">${esc(b.text)}</p>`;
    default:
      return "";
  }
}

function lessonPage(page) {
  const data = CONTENT[String(page)];
  if (!data) return "";
  return `<section class="page">
    ${data.title ? `<h3 class="pt">${esc(data.title)}</h3>` : ""}
    ${data.titleEn ? `<p class="pten">${esc(data.titleEn)}</p>` : ""}
    ${data.blocks.map(block).join("")}
    <p class="src">— صفحة ${page} من المذكرة</p>
  </section>`;
}

// ── questions ──
function question(q, index) {
  const key = `${q.page}:${q.number}`;
  const steps = SOLUTIONS[key] ?? [];
  const opts = q.options
    .map((o, i) => {
      const right = mode === "solved" && i === q.answerIndex;
      return `<div class="opt${right ? " right" : ""}"><b>${LETTERS[i]})</b> ${mathText(
        o
      )}${right ? " ✓" : ""}</div>`;
    })
    .join("");

  return `<div class="q">
    <div class="qh"><b>${index}.</b> ${mathText(q.body)}${
      mode === "solved" && !q.verified
        ? ' <span class="flag">— تحتاج مراجعة</span>'
        : ""
    }</div>
    <div class="opts">${opts}</div>
    ${
      mode === "solved" && steps.length
        ? `<ol class="steps">${steps.map((s) => `<li>${mathText(s)}</li>`).join("")}</ol>`
        : ""
    }
    ${mode === "blank" ? '<div class="work"></div>' : ""}
  </div>`;
}

// ── answer key grid ──
function answerKey() {
  const secs = [];
  for (const q of questions) {
    const last = secs[secs.length - 1];
    if (last && last.title === q.section) last.items.push(q);
    else secs.push({ title: q.section, items: [q] });
  }
  return `<section class="page"><h3 class="pt">مفتاح الإجابات</h3>
    <p class="legend">⚠ = إجابة تم حلها ولم تُؤخذ من مفتاح المذكرة، تحتاج مراجعتك.</p>
    ${secs
      .map(
        (s) => `<p class="sub">${esc(s.title)}</p><div class="grid">${s.items
          .map(
            (q, i) =>
              `<div class="cell"><span class="n">${i + 1}</span> <b>${
                LETTERS[q.answerIndex]
              }</b>${q.verified ? "" : ' <span class="flag">⚠</span>'}</div>`
          )
          .join("")}</div>`
      )
      .join("")}
  </section>`;
}

const unverified = questions.filter((q) => !q.verified).length;
const examQs = questions.filter((q) => q.topic === "mock-exam");

// Solutions for the questions printed on one booklet page, shown on the sheet
// straight after it so the teacher reads page then answers, page then answers.
function annotationFor(page) {
  const items = questions.filter((q) => q.page === page);
  if (!items.length) return "";
  return `<div class="sheet ann">
    <p class="annh">إجابات صفحة ${page} من المذكرة</p>
    ${items
      .map((q) => {
        const steps = SOLUTIONS[`${q.page}:${q.number}`] ?? [];
        return `<div class="q">
          <div class="qh"><b>سؤال ${q.number}:</b> الإجابة
            <span class="ansletter">${LETTERS[q.answerIndex]}</span>
            <span class="ansval">${mathText(q.options[q.answerIndex])}</span>
            ${q.verified ? '<span class="okflag">✔ مؤكدة من مفتاح المذكرة</span>' : '<span class="flag">⚠ تحتاج مراجعة</span>'}
          </div>
          ${steps.length ? `<ol class="steps">${steps.map((t) => `<li>${mathText(t)}</li>`).join("")}</ol>` : ""}
        </div>`;
      })
      .join("")}
  </div>`;
}

let body;
if (style === "original") {
  const pages = bookletPages();
  // The booklet's answer key is page 77; it has no place in a blank paper.
  const wanted = mode === "blank" ? pages.filter((p) => p.page !== 77) : pages;
  body = wanted
    .map(
      (p) =>
        `<div class="sheet"><img src="file://${p.file}"></div>` +
        (mode === "solved" ? annotationFor(p.page) : "")
    )
    .join("") + (mode === "solved" ? `<div class="sheet">${answerKey()}</div>` : "");
} else {
  body = `
<h1>الاختبار الموحد</h1>
<p class="sub2">قدرات الرياضيات — مذكرة أ. محمد جمعة العساف</p>
<p class="mode">${mode === "solved" ? "نسخة المعلم — مع الإجابات وطريقة الحل" : "نسخة للحل"}</p>
${
  mode === "solved" && unverified
    ? `<div class="warnbox"><b>ملاحظة للمعلم:</b> ${unverified} إجابة من أصل ${questions.length} تم حلها ولم تُؤخذ من مفتاح المذكرة (صفحة 77)، وهي معلّمة بـ «تحتاج مراجعة». الباقي مؤكد من المفتاح.</div>`
    : ""
}
${LESSONS.map((lesson) => {
  const items = questions.filter((q) => q.section === lesson.classWork);
  return `<h2 class="lesson">${esc(lesson.title)} <span class="en">${esc(
    lesson.titleEn
  )}</span></h2>
    ${mode === "solved" ? lesson.pages.map(lessonPage).join("") : ""}
    <h3 class="cw">${esc(lesson.classWork)}</h3>
    ${items.map((q, i) => question(q, i + 1)).join("")}`;
}).join("")}
<h2 class="lesson">الاختبار النهائي</h2>
${examQs.map((q, i) => question(q, i + 1)).join("")}
${mode === "solved" ? answerKey() : ""}
`;
}

// KaTeX's stylesheet points at its fonts relatively ("fonts/KaTeX_Main…"),
// which resolves against wherever this HTML is written, not the package. Left
// alone the maths fonts silently fail to load and Chrome substitutes — which
// renders \neq as an equals sign with no slash.
const katexDir = resolve(ROOT, "node_modules/katex/dist");
const css = readFileSync(resolve(katexDir, "katex.min.css"), "utf8").replace(
  /url\((['"]?)fonts\//g,
  `url($1file://${katexDir}/fonts/`
);
const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>${css}
body{font-family:"Geeza Pro","Al Bayan",system-ui,sans-serif;color:#0f172a;font-size:12pt;line-height:1.9;margin:0}
h1{font-size:20pt;margin:0}
.sub2{color:#555;margin:2px 0}
.mode{font-weight:700;margin:0 0 10px}
.warnbox{border:1px solid #f59e0b;background:#fffbeb;padding:8px;margin-bottom:12px;font-size:10pt}
h2.lesson{font-size:15pt;border-bottom:2px solid #334155;margin:18px 0 8px;break-before:page}
h3.cw{font-size:12pt;color:#334155;margin:10px 0 6px}
.page{break-inside:auto;margin-bottom:10px}
.pt{font-size:13pt;text-align:center;margin:8px 0 2px}
.pten{text-align:center;color:#b91c1c;margin:0 0 6px;font-size:10pt}
.src{font-size:8pt;color:#94a3b8;text-align:left;margin:2px 0 8px}
.bh{color:#b91c1c;border-bottom:1px solid #fca5a5;margin:10px 0 4px;font-size:12pt}
.en{color:#2563eb;font-size:9pt;margin-inline-start:6px}
.sub{font-weight:700;color:#1e40af;margin:8px 0 2px}
table{width:100%;border-collapse:collapse;margin:4px 0}
td{border:1px solid #94a3b8;padding:3px 6px}
td.num{width:26px;text-align:center;background:#f1f5f9;font-weight:700}
.note{border-inline-start:3px solid #60a5fa;background:#eff6ff;padding:5px 8px;margin:6px 0}
.ex{border:1px solid #cbd5e1;background:#f8fafc;padding:6px 8px;margin:6px 0}
.blank{border:1px dashed #cbd5e1;padding:14px;text-align:center;color:#94a3b8}
.q{break-inside:avoid;page-break-inside:avoid;border-bottom:1px solid #e2e8f0;padding:6px 0;margin-bottom:4px}
.qh{font-size:11pt}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin:3px 0}
.opt{font-size:10.5pt}
.opt.right{background:#dcfce7;font-weight:700;padding:1px 4px;border-radius:3px}
.flag{color:#b45309;font-size:9pt}
.steps{margin:4px 14px 0;font-size:10pt;color:#1e293b}
.steps li{margin-bottom:1px}
.work{height:80px;border:1px dashed #cbd5e1;border-radius:4px;margin-top:4px}
.legend{font-size:9pt;color:#555;margin-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:2px;margin-bottom:8px}
.cell{border:1px solid #cbd5e1;text-align:center;font-size:9pt;padding:1px}
.cell .n{color:#64748b}
.m{display:inline-block;vertical-align:middle}
.sheet{break-after:page;page-break-after:always}
.sheet img{width:100%;display:block}
.ann{padding:4mm 0}
.annh{font-size:13pt;font-weight:700;border-bottom:2px solid #334155;padding-bottom:3px;margin:0 0 8px}
.ansletter{display:inline-block;background:#166534;color:#fff;border-radius:4px;padding:0 7px;font-weight:700;margin:0 3px}
.ansval{background:#dcfce7;padding:1px 5px;border-radius:3px}
.okflag{color:#166534;font-size:9pt;margin-inline-start:6px}
</style></head><body>${body}</body></html>`;

const tmp = resolve(ROOT, ".export.html");
writeFileSync(tmp, html);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto("file://" + tmp, { waitUntil: "networkidle0", timeout: 120000 });
await page.pdf({
  path: outPath,
  format: "A4",
  printBackground: true,
  margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
  displayHeaderFooter: true,
  headerTemplate: "<div></div>",
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#94a3b8;text-align:center"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
});
await browser.close();

console.log(
  `${mode === "solved" ? "Teacher copy" : "Question paper"} written to ${outPath}\n` +
    `  ${questions.length} questions` +
    (mode === "solved"
      ? `, ${questions.length - unverified} confirmed by the booklet key, ${unverified} flagged for review`
      : "")
);
