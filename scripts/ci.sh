#!/usr/bin/env bash
set -euo pipefail

node scripts/check-js.mjs
npm run fmt:check
node scripts/run-tests.mjs
