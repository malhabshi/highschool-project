#!/usr/bin/env node
// Load the quiz questions extracted from the booklet into Supabase.
// Usage:
//   node scripts/seed-quiz.mjs             # only seeds when the table is empty
//   node scripts/seed-quiz.mjs --replace   # wipes quiz_questions first, then reloads
//
// Run supabase/quiz.sql first to create the table.
// Reads SUPABASE_DB_URL from .env.local, same as scripts/run-sql.mjs.
import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

function loadEnv() {
  const p = new URL("../.env.local", import.meta.url);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Missing SUPABASE_DB_URL in .env.local");
  process.exit(1);
}

const replace = process.argv.includes("--replace");

const dataPath = new URL("../src/data/quiz-questions.json", import.meta.url);
const { questions } = JSON.parse(readFileSync(dataPath, "utf8"));

// Step-by-step solutions live in their own file, keyed "page:number".
const stepsPath = new URL("../src/data/solutions.json", import.meta.url);
const { steps: SOLUTIONS } = JSON.parse(readFileSync(stepsPath, "utf8"));
const stepsFor = (q) => SOLUTIONS[`${q.page}:${q.number}`] ?? [];

const missing = questions.filter((q) => stepsFor(q).length === 0);
if (missing.length > 0) {
  throw new Error(
    `No solution steps for ${missing.length} question(s): ` +
      missing.map((q) => `${q.page}:${q.number}`).join(", ")
  );
}

// Fail loudly on malformed rows rather than seeding a broken quiz.
questions.forEach((q, i) => {
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw new Error(`Question ${i} (page ${q.page}) must have exactly 4 options`);
  }
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex > 3) {
    throw new Error(`Question ${i} (page ${q.page}) has an out-of-range answerIndex`);
  }
});

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  const { rows } = await client.query("select count(*)::int as n from quiz_questions");
  if (rows[0].n > 0 && !replace) {
    console.log(
      `quiz_questions already has ${rows[0].n} rows. Re-run with --replace to reload.`
    );
    process.exit(0);
  }
  if (replace) await client.query("delete from quiz_questions");

  let position = 0;
  for (const q of questions) {
    await client.query(
      `insert into quiz_questions
         (topic, section, source_page, number, body, options, answer_index, verified, work, steps, position)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        q.topic,
        q.section,
        q.page ?? null,
        q.number ?? null,
        q.body,
        q.options,
        q.answerIndex,
        q.verified === true,
        q.work ?? "",
        stepsFor(q),
        position++,
      ]
    );
  }

  const verified = questions.filter((q) => q.verified).length;
  console.log(
    `Seeded ${questions.length} questions (${verified} confirmed by the booklet key, ${
      questions.length - verified
    } awaiting review).`
  );
} catch (e) {
  console.error("Seed failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
