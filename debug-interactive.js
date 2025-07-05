#!/usr/bin/env node

import { selectAudioDeviceInteractively } from './dist/unplayable.js';

const logger = {
    debug: (msg, ...args) => console.log(`DEBUG: ${msg}`, ...args),
    info: (msg, ...args) => console.log(`INFO: ${msg}`, ...args),
    error: (msg, ...args) => console.log(`ERROR: ${msg}`, ...args),
    warn: (msg, ...args) => console.log(`WARN: ${msg}`, ...args)
};

async function testInteractiveSelection() {
    console.log('Testing interactive device selection...');

    try {
        const device = await selectAudioDeviceInteractively(logger);
        console.log('Selected device:', device);
    } catch (error) {
        console.error('Error:', error);
    }
}

testInteractiveSelection(); 