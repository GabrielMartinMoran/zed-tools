#!/usr/bin/env bun

const args = Bun.argv.slice(2);

import * as readline from 'node:readline';
import { routeCommand } from './command-router';

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
}

try {
    const args = process.argv.slice(2);
    routeCommand(args);
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
