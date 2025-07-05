#!/usr/bin/env node

import { getAudioDevices } from './dist/unplayable.js';

const logger = {
    debug: (msg, ...args) => console.log(`DEBUG: ${msg}`, ...args),
    info: (msg, ...args) => console.log(`INFO: ${msg}`, ...args),
    error: (msg, ...args) => console.log(`ERROR: ${msg}`, ...args),
    warn: (msg, ...args) => console.log(`WARN: ${msg}`, ...args)
};

async function testDeviceParsing() {
    console.log('Testing audio device parsing...');

    try {
        const devices = await getAudioDevices(logger);
        console.log('Found devices:', devices);
        console.log('Device count:', devices.length);
    } catch (error) {
        console.error('Error:', error);
    }
}

testDeviceParsing(); 