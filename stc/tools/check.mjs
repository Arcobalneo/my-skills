#!/usr/bin/env node
import { runCheck } from './check/src/cli.mjs';

process.exitCode = runCheck(process.argv.slice(2), {
  usage: 'node <本 skill 目录>/tools/check.mjs',
});
