#!/usr/bin/env bun

import { routeCommand } from './command-router';

const args = Bun.argv.slice(2);

try {
    const args = process.argv.slice(2);
    routeCommand(args);
} catch (e: any) {
    console.error(e.message);
    process.exit(1);
}
