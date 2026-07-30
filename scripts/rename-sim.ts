#!/usr/bin/env tsx
/**
 * scripts/rename-sim.ts
 *
 * Renames the sim template for a new simulation at the **sim** level
 * (package id, display name, Colors/Namespace/Preferences). Screen packages
 * stay as `src/sim-screen/` with `Sim*` class names so
 * `npm run scaffold-screens` can emit N fleet-named screen folders afterward.
 *
 * Usage:
 *   npm run rename -- --id <kebab-id> --name "<Display Name>"
 *
 * Examples:
 *   npm run rename -- --id friction --name "Friction"
 *   npm run rename -- --id wave-interference --name "Wave Interference"
 *
 * The class prefix is derived automatically:
 *   "Friction"          → prefix "Friction"
 *   "Wave Interference" → prefix "WaveInterference"
 *
 * Override the prefix explicitly with --prefix:
 *   npm run rename -- --id my-sim --name "My Simulation" --prefix MySim
 *
 * After running:
 *   npm run scaffold-screens -- --screens Intro,Lab   ← or omit for single screen
 *   npm run check
 */

import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Argument parsing ──────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const newId = getArg("--id");
const newName = getArg("--name");

if (!(newId && newName)) {
  console.error('Usage: npm run rename -- --id <kebab-id> --name "<Display Name>"');
  console.error("");
  console.error("Examples:");
  console.error('  npm run rename -- --id friction --name "Friction"');
  console.error('  npm run rename -- --id wave-interference --name "Wave Interference"');
  process.exit(1);
}

// PascalCase class prefix: "Wave Interference" → "WaveInterference"
const newPrefix =
  getArg("--prefix") ??
  newName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");

// camelCase prefix: "WaveInterference" → "waveInterference"
const newCamel = newPrefix.charAt(0).toLowerCase() + newPrefix.slice(1);

const ROOT = resolve(process.cwd());

// ── Skip lists ────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([".git", "node_modules", "dist", ".cache", ".vite", "scripts"]);
const TEXT_EXTS = new Set([".ts", ".js", ".json", ".html", ".md", ".css", ".svg", ".txt", ".webmanifest", ".toml"]);

// ── Content replacements ──────────────────────────────────────────────────────
// Sim-level only. Screen classes (SimScreen, SimModel, …) and `sim-screen/` are
// left for scaffold-screens. Longer strings must come first to avoid partial matches.

const REPLACEMENTS: ReadonlyArray<[string, string]> = [
  // Shared / preferences (not per-screen)
  ["SimPreferencesModel", `${newPrefix}PreferencesModel`],
  ["SimPreferencesNode", `${newPrefix}PreferencesNode`],
  ["SimColors", `${newPrefix}Colors`],
  ["SimNamespace", `${newPrefix}Namespace`],
  // camelCase identifier
  ["simQueryParameters", `${newCamel}QueryParameters`],
  // Display strings (all locales + PWA)
  ["SceneryStack Template", newName],
  ["Plantilla de Simulación", newName],
  ["Modèle de Simulation", newName],
  ["SimTemplate", newPrefix],
  ["A SceneryStack simulation template for one or N screens.", `A SceneryStack simulation: ${newName}.`],
  ["A SceneryStack simulation template for one or N screens", `A SceneryStack simulation: ${newName}`],
  // Kebab package id
  ["scenerystack-template", newId],
];

// ── Utilities ─────────────────────────────────────────────────────────────────

function replaceAll(str: string, search: string, replacement: string): string {
  return str.split(search).join(replacement);
}

function applyReplacements(text: string): string {
  let result = text;
  for (const [search, replacement] of REPLACEMENTS) {
    if (search !== replacement) {
      result = replaceAll(result, search, replacement);
    }
  }
  return result;
}

function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot !== -1 ? filename.slice(dot) : "";
}

// ── Pass 1: update file contents ──────────────────────────────────────────────

function processContents(dir: string): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      processContents(full);
    } else if (TEXT_EXTS.has(fileExtension(entry))) {
      const original = readFileSync(full, "utf8");
      const transformed = applyReplacements(original);
      if (transformed !== original) {
        writeFileSync(full, transformed, "utf8");
        console.log(`  updated  ${full.slice(ROOT.length + 1)}`);
      }
    }
  }
}

// ── Pass 2: rename files and directories (children before parents) ────────────

interface RenameOp {
  from: string;
  to: string;
}

function collectRenames(dir: string, renameOps: RenameOp[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectRenames(full, renameOps);
    }
    const newEntry = applyReplacements(entry);
    if (newEntry !== entry) {
      renameOps.push({ from: full, to: join(dir, newEntry) });
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log("\nRenaming sim template →", newName);
console.log(`  id:     scenerystack-template → ${newId}`);
console.log(`  name:   SceneryStack Template → ${newName}`);
console.log(`  prefix: Sim          → ${newPrefix}`);
console.log(`  camel:  sim          → ${newCamel}`);
console.log("  (screen packages left as sim-screen/ for scaffold-screens)");
console.log("");

console.log("Pass 1: updating file contents…");
processContents(ROOT);

console.log("\nPass 2: renaming files and directories…");
const ops: RenameOp[] = [];
collectRenames(ROOT, ops);
for (const { from, to } of ops) {
  renameSync(from, to);
  console.log(`  renamed  ${from.slice(ROOT.length + 1)}  →  ${to.slice(ROOT.length + 1)}`);
}

console.log("\nDone.");
console.log("\nNext steps:");
console.log("  1. npm run scaffold-screens -- --screens Intro,Lab");
console.log("     (omit --screens to use one screen named after the sim)");
console.log("  2. npm run check");
console.log("  3. git diff --stat");
console.log("  4. Update doc/implementation-notes.md for your simulation.");
