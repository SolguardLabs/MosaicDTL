#!/usr/bin/env bash
set -euo pipefail

node scripts/check-js.mjs
node scripts/run-tests.mjs
