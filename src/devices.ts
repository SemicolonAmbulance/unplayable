/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs/promises';
import * as path from 'path';

import { AudioDevice, AudioDeviceConfig, Logger } from './types';
import { AudioDeviceError } from './error';
import { run } from './util/child';

/**
 * Get ffmpeg command path from environment or default
 */
const getFFmpegPath = (): string => {
    return process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
};

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
            const ffmpegPath = getFFmpegPath();
            const result = await run(ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'], {
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
        const ffmpegPath = getFFmpegPath();
        const result = await run(ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', '""'], {
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
            const ffmpegPath = getFFmpegPath();
            const testResult = await run(ffmpegPath, [
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
            const ffmpegPath = getFFmpegPath();
            const infoResult = await run(ffmpegPath, [
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

/**
 * Test if an audio device is working by attempting a short recording
 * @param deviceIndex Device index to test
 * @param logger Optional logger for debugging
 * @returns Promise resolving to true if device works
 */
export const testAudioDevice = async (deviceIndex: string, logger?: Logger): Promise<boolean> => {
    try {
        const ffmpegPath = getFFmpegPath();
        await run(ffmpegPath, [
            '-f', 'avfoundation',
            '-i', `:${deviceIndex}`,
            '-t', '0.1',
            '-f', 'null',
            '-'
        ], {
            logger,
            timeout: 2000
        });

        logger?.debug(`Device ${deviceIndex} test: PASS`);
        return true;
    } catch (error: any) {
        logger?.debug(`Device ${deviceIndex} test: FAIL - ${error.message}`);
        return false;
    }
};

/**
 * Interactively select an audio device from available options
 * @param logger Optional logger for output
 * @returns Promise resolving to selected device or null if cancelled
 */
export const selectAudioDeviceInteractively = async (logger?: Logger): Promise<AudioDevice | null> => {
    if (!logger) {
        throw new Error('Logger is required for interactive device selection');
    }

    logger.info('🎙️  Available audio devices:');
    const devices = await parseAudioDevices(logger);

    if (devices.length === 0) {
        logger.error('❌ No audio devices found. Make sure ffmpeg is installed and audio devices are available.');
        return null;
    }

    // Test devices and show status
    logger.info('🔍 Testing audio devices...');
    const deviceTestResults = await Promise.allSettled(
        devices.map(async (device) => {
            const isWorking = await testAudioDevice(device.index, logger);
            return { ...device, isWorking };
        })
    );

    const deviceStatuses = deviceTestResults.map((result, index) => {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            logger?.debug(`Device ${devices[index].index} test failed: ${result.reason}`);
            return { ...devices[index], isWorking: false };
        }
    });

    // Display devices with status
    deviceStatuses.forEach((device, i) => {
        const status = device.isWorking ? '✅' : '❌';
        logger.info(`   ${i + 1}. ${status} ${device.name}`);
    });

    const workingDevices = deviceStatuses.filter(d => d.isWorking);
    if (workingDevices.length === 0) {
        logger.error('❌ No working audio devices found. This may be due to:');
        logger.error('   • Microphone permission not granted to Terminal/iTerm');
        logger.error('   • Audio devices in use by other applications');
        logger.error('   • ffmpeg configuration issues');
        logger.error('');
        logger.error('💡 Try:');
        logger.error('   • Go to System Preferences → Security & Privacy → Privacy → Microphone');
        logger.error('   • Make sure Terminal (or your terminal app) has microphone access');
        logger.error('   • Close other audio applications and try again');
        return null;
    }

    logger.info('');
    logger.info('📋 Select an audio device by entering its number (1-' + devices.length + '):');

    return new Promise((resolve) => {
        // Check if stdin is a TTY (terminal)
        const isInteractive = process.stdin.isTTY;

        if (!isInteractive) {
            logger.error('❌ Interactive device selection requires a TTY. Please run this command in a terminal.');
            logger.error('💡 If you are running this in a script, consider using a non-interactive method or pre-configuring the device.');
            resolve(null);
            return;
        }

        // Set up keyboard input for interactive mode
        let wasRawMode = false;
        try {
            if (process.stdin.setRawMode) {
                wasRawMode = process.stdin.isRaw || false;
                process.stdin.setRawMode(true);
            }
        } catch (error) {
            logger.error('❌ Cannot set raw mode for input. Interactive selection may not work properly.');
            logger.debug(`Raw mode error: ${error}`);
        }

        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        // Clear any buffered input
        process.stdin.pause();
        process.stdin.resume();

        // Small delay to ensure any buffered input is cleared
        setTimeout(() => {
            process.stdin.on('data', keyHandler);
            process.stdout.write('📋 Select an audio device: ');
        }, 100);

        let inputBuffer = '';

        const cleanup = () => {
            try {
                if (process.stdin.setRawMode) {
                    process.stdin.setRawMode(wasRawMode);
                }
            } catch (error) {
                logger.debug(`Error restoring raw mode: ${error}`);
            }
            process.stdin.pause();
            process.stdin.removeListener('data', keyHandler);
        };

        const keyHandler = (key: string) => {
            const keyCode = key.charCodeAt(0);

            // Debug logging
            logger.debug(`Received key: "${key}" (code: ${keyCode})`);

            if (keyCode === 13) { // ENTER key
                const selectedIndex = parseInt(inputBuffer) - 1;

                if (selectedIndex >= 0 && selectedIndex < devices.length) {
                    const selectedDevice = deviceStatuses[selectedIndex];
                    process.stdout.write('\n\n');

                    if (!selectedDevice.isWorking) {
                        logger.warn(`⚠️  Warning: Selected device "${selectedDevice.name}" failed testing`);
                        logger.warn('   This device may not work properly for recording');
                        logger.warn('   Consider selecting a device marked with ✅');
                    } else {
                        logger.info(`✅ Selected: ${selectedDevice.name}`);
                    }

                    // Cleanup and resolve
                    cleanup();
                    resolve(selectedDevice);
                } else {
                    logger.error('❌ Invalid selection. Please enter a number between 1 and ' + devices.length);
                    inputBuffer = '';
                    process.stdout.write('📋 Select an audio device: ');
                }
            } else if (keyCode === 3) { // Ctrl+C
                logger.info('\n❌ Selection cancelled');
                cleanup();
                resolve(null);
            } else if (keyCode >= 48 && keyCode <= 57) { // Numbers 0-9
                inputBuffer += key;
                process.stdout.write(key);
            } else if (keyCode === 127) { // Backspace
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            }
        };
    });
};

/**
 * High-level function to select and configure an audio device
 * @param preferencesDir Directory to save configuration
 * @param logger Optional logger for output
 * @param debug Whether to list devices in debug mode
 * @returns Promise resolving to success message or throwing error
 */
export const selectAndConfigureAudioDevice = async (
    preferencesDir: string,
    logger?: Logger,
    debug: boolean = false
): Promise<string> => {
    if (!logger) {
        throw new Error('Logger is required for audio device selection');
    }

    logger.info('🎛️  Starting audio device selection...');
    logger.info('');
    logger.info('This device will be used to capture audio for:');
    logger.info('  • Audio commit messages (audio-commit command)');
    logger.info('  • Audio code reviews (audio-review command)');
    logger.info('');

    // List available devices in debug mode
    if (debug) {
        const devices = await parseAudioDevices(logger);
        logger.info('🎙️  Available audio devices:');
        devices.forEach((device, i) => {
            logger.info(`   ${i + 1}. ${device.name}`);
        });
        logger.info('');
    }

    const selectedDevice = await selectAudioDeviceInteractively(logger);

    if (selectedDevice === null) {
        logger.error('❌ Audio device selection cancelled or failed');
        throw new Error('Audio device selection cancelled or failed');
    }

    // Get device capabilities
    const deviceInfo = await getAudioDeviceInfo(selectedDevice.index, logger);
    const capabilities = deviceInfo || {
        audioDevice: selectedDevice.index,
        audioDeviceName: selectedDevice.name
    };

    // Save configuration
    await saveAudioDeviceConfig(capabilities, preferencesDir, logger);

    const configPath = path.join(preferencesDir, 'audio-device.json');
    logger.info('💾 Audio device saved to %s', configPath);

    logger.info('✅ Audio device selection complete');
    logger.info('');
    logger.info('You can now run audio-commit or audio-review commands to use your selected device');
    logger.info('To change your audio device in the future, run the select-audio command again');

    return `Audio device configured successfully: ${selectedDevice.name}`;
}; 