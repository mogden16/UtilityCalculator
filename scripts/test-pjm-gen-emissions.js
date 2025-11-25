#!/usr/bin/env node
/**
 * Quick manual check for the PJM gen emissions route.
 *
 * Usage: node scripts/test-pjm-gen-emissions.js [baseUrl]
 * Defaults to http://localhost:3000 if no baseUrl is provided.
 */
const baseUrl = process.argv[2] || "http://localhost:3000";
const endpoint = `${baseUrl.replace(/\/$/, "")}/api/pjm-gen-emissions`;

async function main() {
  try {
    const res = await fetch(endpoint);
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("First 500 chars:\n", text.slice(0, 500));
  } catch (err) {
    console.error("Request failed:", err);
    process.exitCode = 1;
  }
}

main();
