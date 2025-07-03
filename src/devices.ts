/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs/promises';
import * as path from 'path';

import { AudioDevice, AudioDeviceConfig, Logger } from './types';
import { AudioDeviceError } from './error';
import { run } from './util/child';

/**
 * Detects the best available audio device for recording
 * @param logger Optional logger for debugging
 * @returns Promise resolving to audio device index as string
 */
export const detectBestAudioDevice = async (logger?: Logger): Promise<string> => {
    try {
        // First, try to find a working device using the new detection
        const workingDevice = await findWorkingAudioDevice(logger);
        if (workingDevice) {
            logger?.debug(`✅ Best audio device detected: [${workingDevice.index}] ${workingDevice.name}`);
            return workingDevice.index;
        }

        // Fallback to preference-based detection if format testing fails
        try {
            const result = await run('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'], {
                logger,
                timeout: 10000
            });

            // ffmpeg returns error code but we get the device list in stderr
            const output = result.stderr || result.stdout || '';

            // Parse audio devices from output
            const audioDevicesSection = output.split('AVFoundation audio devices:')[1];
            if (!audioDevicesSection) return '1'; // Default fallback

            const deviceLines = audioDevicesSection.split('\n')
                .filter((line: string) => line.includes('[') && line.includes(']'))
                .map((line: string) => line.trim());

            // Prefer AirPods, then built-in microphone over virtual/external devices
            const preferredDevices = [
                'AirPods',
                'MacBook Pro Microphone',
                'MacBook Air Microphone',
                'Built-in Microphone',
                'Internal Microphone'
            ];

            // Look for devices in order of preference
            for (const preferred of preferredDevices) {
                for (const deviceLine of deviceLines) {
                    if (deviceLine.toLowerCase().includes(preferred.toLowerCase())) {
                        // Extract device index
                        const match = deviceLine.match(/\[(\d+)\]/);
                        if (match) {
                            return match[1];
                        }
                    }
                }
            }
        } catch (ffmpegError) {
            logger?.debug(`FFmpeg device listing failed: ${ffmpegError}`);
        }

        // If no preferred device found, use device 1 as default (usually better than 0)
        return '1';
    } catch (error) {
        logger?.error(`Error detecting audio device: ${error}`);
        // Fallback to device 1
        return '1';
    }
};

/**
 * Parses available audio devices from system
 * @param logger Optional logger for debugging
 * @returns Promise resolving to array of audio devices with index and name
 */
export const parseAudioDevices = async (logger?: Logger): Promise<AudioDevice[]> => {
    try {
        const result = await run('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'], {
            logger,
            timeout: 10000
        });

        const output = result.stderr || result.stdout || '';
        const audioDevicesSection = output.split('AVFoundation audio devices:')[1];

        if (audioDevicesSection) {
            const deviceLines = audioDevicesSection.split('\n')
                .filter((line: string) => line.includes('[') && line.includes(']'))
                .map((line: string) => line.trim());

            const devices = deviceLines.map((line: string) => {
                const match = line.match(/\[(\d+)\]\s+(.+)/);
                if (match) {
                    return { index: match[1], name: match[2] };
                }
                return null;
            }).filter(Boolean) as AudioDevice[];

            logger?.debug(`Found ${devices.length} audio devices`);
            return devices;
        }
        return [];
    } catch (error) {
        logger?.error(`Error parsing audio devices: ${error}`);
        return [];
    }
};

/**
 * Lists all available audio devices
 * @param logger Optional logger for debugging
 * @returns Promise resolving to array of audio devices
 */
export const listAudioDevices = async (logger?: Logger): Promise<AudioDevice[]> => {
    return await parseAudioDevices(logger);
};

/**
 * Validates if an audio device exists and is accessible
 * @param deviceIndex Device index to validate
 * @param logger Optional logger for debugging
 * @returns Promise resolving to true if device is valid
 */
export const validateAudioDevice = async (deviceIndex: string, logger?: Logger): Promise<boolean> => {
    try {
        const devices = await parseAudioDevices(logger);
        const device = devices.find(d => d.index === deviceIndex);

        if (!device) {
            return false;
        }

        // Test if we can access the device by attempting a short recording test
        try {
            const testResult = await run('ffmpeg', [
                '-f', 'avfoundation',
                '-i', `:${deviceIndex}`,
                '-t', '0.1',
                '-f', 'null',
                '-'
            ], {
                logger,
                timeout: 5000
            });

            return testResult.code === 0;
        } catch (testError) {
            logger?.debug(`Device test failed for ${deviceIndex}: ${testError}`);
            return false;
        }
    } catch (error) {
        logger?.error(`Error validating audio device ${deviceIndex}: ${error}`);
        return false;
    }
};

/**
 * Gets detailed information about a specific audio device
 * @param deviceIndex Device index to get info for
 * @param logger Optional logger for debugging
 * @returns Promise resolving to device configuration or null if not found
 */
export const getAudioDeviceInfo = async (deviceIndex: string, logger?: Logger): Promise<AudioDeviceConfig | null> => {
    try {
        const devices = await parseAudioDevices(logger);
        const device = devices.find(d => d.index === deviceIndex);

        if (!device) {
            return null;
        }

        // Get detailed device information
        try {
            const infoResult = await run('ffmpeg', [
                '-f', 'avfoundation',
                '-list_devices', 'true',
                '-i', `:${deviceIndex}`
            ], {
                logger,
                timeout: 5000
            });

            const output = infoResult.stderr || infoResult.stdout || '';

            // Parse device capabilities (sample rate, channels, etc.)
            // This is a simplified version - in practice you might want more detailed parsing
            const sampleRateMatch = output.match(/(\d+)\s*Hz/);
            const channelsMatch = output.match(/(\d+)\s*ch/);

            return {
                audioDevice: deviceIndex,
                audioDeviceName: device.name,
                sampleRate: sampleRateMatch ? parseInt(sampleRateMatch[1]) : undefined,
                channels: channelsMatch ? parseInt(channelsMatch[1]) : undefined,
                channelLayout: channelsMatch && parseInt(channelsMatch[1]) === 2 ? 'stereo' : 'mono'
            };
        } catch (infoError) {
            logger?.debug(`Failed to get detailed info for device ${deviceIndex}: ${infoError}`);

            // Return basic info
            return {
                audioDevice: deviceIndex,
                audioDeviceName: device.name
            };
        }
    } catch (error) {
        logger?.error(`Error getting device info for ${deviceIndex}: ${error}`);
        return null;
    }
};

/**
 * Attempts to find a working audio device by testing them
 * @param logger Optional logger for debugging
 * @returns Promise resolving to a working device or null
 */
export const findWorkingAudioDevice = async (logger?: Logger): Promise<AudioDevice | null> => {
    try {
        const devices = await parseAudioDevices(logger);

        if (devices.length === 0) {
            throw AudioDeviceError.noDevicesAvailable();
        }

        // Test devices in order of preference
        const preferredOrder = ['AirPods', 'MacBook', 'Built-in', 'Internal'];

        // Sort devices by preference
        const sortedDevices = [...devices].sort((a, b) => {
            const aPreference = preferredOrder.findIndex(pref =>
                a.name.toLowerCase().includes(pref.toLowerCase())
            );
            const bPreference = preferredOrder.findIndex(pref =>
                b.name.toLowerCase().includes(pref.toLowerCase())
            );

            if (aPreference === -1 && bPreference === -1) return 0;
            if (aPreference === -1) return 1;
            if (bPreference === -1) return -1;
            return aPreference - bPreference;
        });

        // Test each device
        for (const device of sortedDevices) {
            logger?.debug(`Testing audio device: [${device.index}] ${device.name}`);

            const isWorking = await validateAudioDevice(device.index, logger);
            if (isWorking) {
                return device;
            }
        }

        return null;
    } catch (error) {
        logger?.error(`Error finding working audio device: ${error}`);
        return null;
    }
};

/**
 * Saves audio device configuration to preferences directory
 * @param config Device configuration to save
 * @param preferencesDir Directory to save configuration in
 * @param logger Optional logger for debugging
 */
export const saveAudioDeviceConfig = async (
    config: AudioDeviceConfig,
    preferencesDir: string,
    logger?: Logger
): Promise<void> => {
    try {
        // Ensure preferences directory exists
        await fs.mkdir(preferencesDir, { recursive: true });

        const configPath = path.join(preferencesDir, 'audio-device.json');
        const configData = JSON.stringify(config, null, 2);

        await fs.writeFile(configPath, configData, 'utf8');
        logger?.debug(`Audio device configuration saved to: ${configPath}`);
    } catch (error) {
        logger?.error(`Failed to save audio device configuration: ${error}`);
        throw new Error(`Failed to save audio device configuration: ${error}`);
    }
};

/**
 * Loads audio device configuration from preferences directory
 * @param preferencesDir Directory to load configuration from
 * @param logger Optional logger for debugging
 * @returns Promise resolving to device configuration or null if not found
 */
export const loadAudioDeviceConfig = async (
    preferencesDir: string,
    logger?: Logger
): Promise<AudioDeviceConfig | null> => {
    try {
        const configPath = path.join(preferencesDir, 'audio-device.json');

        try {
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData) as AudioDeviceConfig;
            logger?.debug(`Audio device configuration loaded from: ${configPath}`);
            return config;
        } catch (readError: any) {
            if (readError.code === 'ENOENT') {
                logger?.debug(`No audio device configuration found at: ${configPath}`);
                return null;
            }
            throw readError;
        }
    } catch (error) {
        logger?.error(`Failed to load audio device configuration: ${error}`);
        return null;
    }
};

/**
 * Checks if audio device configuration exists
 * @param preferencesDir Directory to check for configuration
 * @returns Promise resolving to true if configuration exists
 */
export const audioDeviceConfigExists = async (preferencesDir: string): Promise<boolean> => {
    try {
        const configPath = path.join(preferencesDir, 'audio-device.json');
        await fs.access(configPath);
        return true;
    } catch {
        return false;
    }
}; 