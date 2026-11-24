#!/usr/bin/env node
/**
 * Minimal, no-auth example: call tools/list on the LiveLaunch remote MCP server.
 * No API keys, wallets, or transaction tools are used.
 *
 *   node examples/list-tools.mjs
 */
const MCP_URL = "https://livelaunch.vercel.app/mcp";

const res = await fetch(MCP_URL, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  }),
});

if (!res.ok) {
  throw new Error(`HTTP ${res.status} ${await res.text()}`);
}

const contentType = res.headers.get("content-type") || "";
let payload;
if (contentType.includes("text/event-stream")) {
  const text = await res.text();
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  payload = JSON.parse(dataLines.at(-1));
} else {
  payload = await res.json();
}

if (payload.error) {
  throw new Error(JSON.stringify(payload.error));
}

const tools = payload.result?.tools ?? [];
for (const tool of tools) {
  console.log(`${tool.name}\t${tool.title ?? ""}\t${tool.description ?? ""}`);
}
console.log(`\n${tools.length} tools`);
