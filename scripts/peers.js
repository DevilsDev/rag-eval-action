#!/usr/bin/env node
// Prints the optional peer dependencies of @devilsdev/rag-pipeline-utils
// that a .ragrc.json needs, one per line. Since 3.0.0 the library no longer
// installs them itself, and the CLI the action installs in its own
// directory cannot load the copies in the project's node_modules.
//
//   node scripts/peers.js <config>
//
// A missing or unreadable config prints nothing; the CLI reports the
// problem itself when it runs.
"use strict";

const fs = require("fs");

const PEERS = {
  openai: "openai", // OpenAIConnector, as embedder or llm
  pgvector: "pg", // PgVectorRetriever
};

function peersFor(config) {
  const names = new Set();
  for (const entry of Array.isArray(config.pipeline) ? config.pipeline : []) {
    const peer = entry && PEERS[entry.name];
    if (peer) names.add(peer);
  }
  return [...names].sort();
}

if (require.main === module) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  } catch {
    process.exit(0);
  }
  for (const name of peersFor(config)) console.log(name);
}

module.exports = { peersFor };
