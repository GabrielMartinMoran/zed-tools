#!/usr/bin/env bun

const args = Bun.argv.slice(2);

import { routeCommand } from './command-router';

try {
    const args = process.argv.slice(2);
    routeCommand(args);
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
