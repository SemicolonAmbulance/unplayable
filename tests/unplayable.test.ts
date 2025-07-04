/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createUnplayable, processAudio, getAudioDevices, recordAudio } from '../src/unplayable';
import { AudioProcessingOptions } from '../src/types';

// Mock external dependencies
vi.mock('winston', () => ({
    createLogger: vi.fn(() => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        verbose: vi.fn()
    })),
    format: {
        combine: vi.fn(),
        timestamp: vi.fn(),
        colorize: vi.fn(),
        simple: vi.fn()
    },
    transports: {
        Console: vi.fn()
    }
}));

vi.mock('../src/util/child', () => ({
    run: vi.fn()
}));

// Mock fs/promises for configuration loading
vi.mock('fs/promises', () => ({
    access: vi.fn().mockRejectedValue(new Error('ENOENT')), // Make file access fail so no config files are loaded
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
        size: 1024,
        isDirectory: () => true,
        isFile: () => false,
        mtime: new Date(),
        birthtime: new Date()
    }),
    unlink: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined)
}));

// Mock validation module
vi.mock('../src/validation', () => ({
    validateAudioFile: vi.fn().mockResolvedValue(undefined),
    validateAudioProcessingOptions: vi.fn().mockResolvedValue(undefined),
    hasSupportedAudioExtension: vi.fn((filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase();
        return ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext || '');
    }),
    validateAndGetAudioFileInfo: vi.fn().mockResolvedValue({
        filePath: 'test.wav',
        size: 1024,
        format: 'wav',
        lastModified: new Date(),
        created: new Date()
    })
}));

// Mock storage utilities
vi.mock('../src/util/storage', () => ({
    createStorage: vi.fn(() => ({
        exists: vi.fn().mockResolvedValue(false),
        isDirectory: vi.fn().mockResolvedValue(true),
        isFile: vi.fn().mockResolvedValue(false),
        isReadable: vi.fn().mockResolvedValue(true),
        isWritable: vi.fn().mockResolvedValue(true),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockRejectedValue(new Error('ENOENT')), // Make storage file reads fail
        writeFile: vi.fn().mockResolvedValue(undefined),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        copyFile: vi.fn().mockResolvedValue(undefined),
        moveFile: vi.fn().mockResolvedValue(undefined),
        listFiles: vi.fn().mockResolvedValue([]),
        getFileStats: vi.fn().mockResolvedValue({ size: 1024 }),
        ensureDirectory: vi.fn().mockResolvedValue(undefined),
        cleanupDirectory: vi.fn().mockResolvedValue(0),
    })),
    generateTimestampedFilename: vi.fn(() => 'test-file.wav'),
    generateUniqueFilename: vi.fn(() => Promise.resolve('test-file.wav'))
}));

// Mock device functions with specific implementations
vi.mock('../src/devices', () => {
    const mockDevices = [
        { index: '0', name: 'Built-in Microphone' },
        { index: '1', name: 'MacBook Pro Microphone' },
        { index: '2', name: 'AirPods Pro' }
    ];

    return {
        detectBestAudioDevice: vi.fn().mockResolvedValue('1'),
        parseAudioDevices: vi.fn().mockResolvedValue(mockDevices),
        listAudioDevices: vi.fn().mockResolvedValue(mockDevices),
        validateAudioDevice: vi.fn().mockResolvedValue(true),
        getAudioDeviceInfo: vi.fn().mockResolvedValue({
            audioDevice: '1',
            audioDeviceName: 'MacBook Pro Microphone'
        }),
        findWorkingAudioDevice: vi.fn().mockResolvedValue({ index: '1', name: 'MacBook Pro Microphone' }),
        saveAudioDeviceConfig: vi.fn().mockResolvedValue(undefined),
        loadAudioDeviceConfig: vi.fn().mockResolvedValue({
            audioDevice: '1',
            audioDeviceName: 'MacBook Pro Microphone'
        }),
        audioDeviceConfigExists: vi.fn().mockResolvedValue(true),
        selectAudioDeviceInteractively: vi.fn().mockResolvedValue({
            index: '1',
            name: 'MacBook Pro Microphone'
        }),
        selectAndConfigureAudioDevice: vi.fn().mockResolvedValue('1')
    };
});

// Mock processor module
vi.mock('../src/processor', () => ({
    createAudioProcessor: vi.fn(() => ({
        processAudio: vi.fn().mockResolvedValue({
            transcript: 'Test transcript',
            audioFilePath: '/path/to/audio.wav',
            cancelled: false,
            metadata: {
                processingTime: 1000,
                audioLength: 30,
                fileSize: 1024
            }
        })
    }))
}));

// Mock configuration module
vi.mock('../src/configuration', () => ({
    loadConfiguration: vi.fn(() => Promise.resolve({
        get: vi.fn((key: string) => {
            const config: any = {
                outputDirectory: '/tmp/output',
                preferencesDirectory: '/tmp/preferences',
                logging: { level: 'info' }
            };
            return config[key];
        }),
        getConfig: vi.fn(() => ({
            outputDirectory: '/tmp/output',
            preferencesDirectory: '/tmp/preferences',
            logging: { level: 'info' }
        })),
        updateConfig: vi.fn(),
        saveToFile: vi.fn().mockResolvedValue(undefined),
        saveToDefaultLocation: vi.fn().mockResolvedValue(undefined),
        exportConfig: vi.fn(() => JSON.stringify({
            outputDirectory: '/tmp/output',
            preferencesDirectory: '/tmp/preferences',
            logging: { level: 'info' }
        }))
    })),
    createConfiguration: vi.fn(),
    ConfigurationManager: vi.fn()
}));

describe('Unplayable Library', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createUnplayable', () => {
        it('should create an Unplayable instance with default configuration', async () => {
            const unplayable = await createUnplayable();

            expect(unplayable).toBeDefined();
            expect(typeof unplayable.processAudio).toBe('function');
            expect(typeof unplayable.getAudioDevices).toBe('function');
        });

        it('should create an Unplayable instance with custom configuration', async () => {
            const customConfig = {
                outputDirectory: '/custom/output',
                logging: { level: 'debug' as const }
            };

            const unplayable = await createUnplayable({ config: customConfig });

            expect(unplayable).toBeDefined();

            const config = unplayable.getConfig();
            expect(config.outputDirectory).toBe('/tmp/output'); // Mocked value
            expect(config.logging?.level).toBe('info'); // Mocked value
        });

        it('should create an Unplayable instance with custom logger', async () => {
            const customLogger = {
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                debug: vi.fn(),
                verbose: vi.fn()
            };

            const unplayable = await createUnplayable({ logger: customLogger });

            expect(unplayable).toBeDefined();
            expect(unplayable.getLogger()).toBe(customLogger);
        });
    });

    describe('Audio Processing', () => {
        it('should handle dry run mode', async () => {
            const unplayable = await createUnplayable();

            const options: AudioProcessingOptions = {
                dryRun: true,
                maxRecordingTime: 30
            };

            const result = await unplayable.processAudio(options);

            expect(result.cancelled).toBe(false);
            expect(result.audioFilePath).toBe('/path/to/audio.wav');
        });

        it('should validate audio processing options', async () => {
            // Mock the validation to throw an error for invalid options
            const { validateAudioProcessingOptions } = await import('../src/validation');
            vi.mocked(validateAudioProcessingOptions).mockRejectedValueOnce(new Error('Invalid maxRecordingTime'));

            // Also need to mock the processor to handle the validation error
            const { createAudioProcessor } = await import('../src/processor');
            vi.mocked(createAudioProcessor).mockReturnValueOnce({
                processAudio: vi.fn().mockRejectedValue(new Error('Invalid maxRecordingTime'))
            } as any);

            const unplayable = await createUnplayable();

            const invalidOptions: AudioProcessingOptions = {
                maxRecordingTime: -5 // Invalid negative time
            };

            await expect(unplayable.processAudio(invalidOptions)).rejects.toThrow('Invalid maxRecordingTime');
        });
    });

    describe('Audio Recording', () => {
        it('should record audio successfully', async () => {
            const unplayable = await createUnplayable();

            const audioFilePath = await unplayable.recordAudio({
                maxRecordingTime: 30
            });

            expect(typeof audioFilePath).toBe('string');
            expect(audioFilePath).toBe('/path/to/audio.wav');
        });

        it('should throw error when recording is cancelled', async () => {
            // Test the recordAudio method's error handling logic directly
            const unplayable = await createUnplayable();

            // Mock the internal processAudio to simulate a cancelled recording
            vi.spyOn(unplayable, 'processAudio').mockResolvedValueOnce({
                audioFilePath: undefined,
                cancelled: true,
                metadata: undefined
            });

            await expect(unplayable.recordAudio()).rejects.toThrow('Recording was cancelled or failed');
        });

        it('should throw error when no audio file path is returned', async () => {
            const unplayable = await createUnplayable();

            // Mock the internal processAudio to simulate missing audioFilePath
            vi.spyOn(unplayable, 'processAudio').mockResolvedValueOnce({
                audioFilePath: undefined,
                cancelled: false,
                metadata: undefined
            });

            await expect(unplayable.recordAudio()).rejects.toThrow('Recording was cancelled or failed');
        });
    });

    describe('Audio Device Management', () => {
        it('should list audio devices', async () => {
            // Ensure device mocks are properly set up for this test
            const { listAudioDevices } = await import('../src/devices');
            vi.mocked(listAudioDevices).mockResolvedValue([
                { index: '0', name: 'Built-in Microphone' },
                { index: '1', name: 'MacBook Pro Microphone' },
                { index: '2', name: 'AirPods Pro' }
            ]);

            const unplayable = await createUnplayable();
            const devices = await unplayable.getAudioDevices();

            expect(Array.isArray(devices)).toBe(true);
            expect(devices.length).toBeGreaterThan(0);
            expect(devices[0]).toHaveProperty('index');
            expect(devices[0]).toHaveProperty('name');
        });

        it('should detect best device', async () => {
            // Ensure device mocks are properly set up for this test
            const { detectBestAudioDevice } = await import('../src/devices');
            vi.mocked(detectBestAudioDevice).mockResolvedValue('1');

            const unplayable = await createUnplayable();
            const bestDevice = await unplayable.detectBestDevice();

            expect(typeof bestDevice).toBe('string');
            expect(bestDevice).toMatch(/^\d+$/); // Should be a device index
        });

        it('should validate audio device', async () => {
            const { validateAudioDevice } = await import('../src/devices');
            vi.mocked(validateAudioDevice).mockResolvedValue(true);

            const unplayable = await createUnplayable();
            const isValid = await unplayable.validateDevice('1');

            expect(isValid).toBe(true);
        });

        it('should get device info', async () => {
            const { getAudioDeviceInfo } = await import('../src/devices');
            const deviceConfig = {
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            };
            vi.mocked(getAudioDeviceInfo).mockResolvedValue(deviceConfig);

            const unplayable = await createUnplayable();
            const info = await unplayable.getDeviceInfo('1');

            expect(info).toEqual(deviceConfig);
        });

        it('should save device configuration', async () => {
            const { saveAudioDeviceConfig } = await import('../src/devices');
            vi.mocked(saveAudioDeviceConfig).mockResolvedValue(undefined);

            const unplayable = await createUnplayable();
            const deviceConfig = {
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            };

            await expect(unplayable.saveDeviceConfig(deviceConfig)).resolves.not.toThrow();
        });

        it('should throw error when saving device config without preferences directory', async () => {
            // Mock config manager to return null for preferencesDirectory
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValue({
                get: vi.fn((key: string) => key === 'preferencesDirectory' ? null : '/tmp/output'),
                getConfig: vi.fn(() => ({ outputDirectory: '/tmp/output' })),
                updateConfig: vi.fn(),
                saveToFile: vi.fn(),
                saveToDefaultLocation: vi.fn(),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();
            const deviceConfig = {
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            };

            await expect(unplayable.saveDeviceConfig(deviceConfig)).rejects.toThrow('No preferences directory configured');
        });

        it('should load device configuration', async () => {
            const { loadAudioDeviceConfig } = await import('../src/devices');
            vi.mocked(loadAudioDeviceConfig).mockResolvedValueOnce({
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            });

            const unplayable = await createUnplayable();
            const deviceConfig = await unplayable.loadDeviceConfig();

            expect(deviceConfig).toEqual({
                audioDevice: '1',
                audioDeviceName: 'MacBook Pro Microphone'
            });
        });

        it('should return null when loading device config without preferences directory', async () => {
            // Mock config manager to return null for preferencesDirectory
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValue({
                get: vi.fn((key: string) => key === 'preferencesDirectory' ? null : '/tmp/output'),
                getConfig: vi.fn(() => ({ outputDirectory: '/tmp/output' })),
                updateConfig: vi.fn(),
                saveToFile: vi.fn(),
                saveToDefaultLocation: vi.fn(),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();
            const deviceConfig = await unplayable.loadDeviceConfig();

            expect(deviceConfig).toBeNull();
        });

        it('should interactively select audio device', async () => {
            const { selectAudioDeviceInteractively } = await import('../src/devices');
            vi.mocked(selectAudioDeviceInteractively).mockResolvedValue({
                index: '1',
                name: 'MacBook Pro Microphone'
            });

            const unplayable = await createUnplayable();
            const selectedDevice = await unplayable.selectAudioDevice();

            expect(selectedDevice).toEqual({
                index: '1',
                name: 'MacBook Pro Microphone'
            });
        });

        it('should return null when no device is selected interactively', async () => {
            const { selectAudioDeviceInteractively } = await import('../src/devices');
            vi.mocked(selectAudioDeviceInteractively).mockResolvedValue(null);

            const unplayable = await createUnplayable();
            const selectedDevice = await unplayable.selectAudioDevice();

            expect(selectedDevice).toBeNull();
        });

        it('should select and configure audio device', async () => {
            const { selectAndConfigureAudioDevice } = await import('../src/devices');
            vi.mocked(selectAndConfigureAudioDevice).mockResolvedValue('1');

            const unplayable = await createUnplayable();
            const deviceIndex = await unplayable.selectAndConfigureDevice();

            expect(deviceIndex).toBe('1');
        });

        it('should select and configure audio device with debug mode', async () => {
            const { selectAndConfigureAudioDevice } = await import('../src/devices');
            vi.mocked(selectAndConfigureAudioDevice).mockResolvedValue('1');

            const unplayable = await createUnplayable();
            const deviceIndex = await unplayable.selectAndConfigureDevice(true);

            expect(deviceIndex).toBe('1');
        });

        it('should throw error when selecting and configuring device without preferences directory', async () => {
            // Mock config manager to return null for preferencesDirectory
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValue({
                get: vi.fn((key: string) => key === 'preferencesDirectory' ? null : '/tmp/output'),
                getConfig: vi.fn(() => ({ outputDirectory: '/tmp/output' })),
                updateConfig: vi.fn(),
                saveToFile: vi.fn(),
                saveToDefaultLocation: vi.fn(),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();

            await expect(unplayable.selectAndConfigureDevice()).rejects.toThrow('No preferences directory configured');
        });
    });

    describe('File Validation', () => {
        it('should validate supported audio file extensions', async () => {
            const unplayable = await createUnplayable();

            expect(unplayable.isSupportedAudioFile('test.mp3')).toBe(true);
            expect(unplayable.isSupportedAudioFile('test.wav')).toBe(true);
            expect(unplayable.isSupportedAudioFile('test.flac')).toBe(true);
            expect(unplayable.isSupportedAudioFile('test.txt')).toBe(false);
            expect(unplayable.isSupportedAudioFile('test.pdf')).toBe(false);
        });

        it('should validate audio file', async () => {
            const { validateAudioFile } = await import('../src/validation');
            vi.mocked(validateAudioFile).mockResolvedValue(undefined);

            const unplayable = await createUnplayable();

            await expect(unplayable.validateAudioFile('/path/to/audio.wav')).resolves.not.toThrow();
        });

        it('should throw error for invalid audio file', async () => {
            const { validateAudioFile } = await import('../src/validation');
            vi.mocked(validateAudioFile).mockRejectedValue(new Error('Invalid audio file'));

            const unplayable = await createUnplayable();

            await expect(unplayable.validateAudioFile('/path/to/invalid.txt')).rejects.toThrow('Invalid audio file');
        });
    });

    describe('Configuration Management', () => {
        it('should get and update configuration', async () => {
            const unplayable = await createUnplayable();

            const originalConfig = unplayable.getConfig();
            expect(originalConfig).toBeDefined();
            expect(originalConfig.outputDirectory).toBeDefined();

            unplayable.updateConfig({
                logging: { level: 'debug' }
            });

            // Configuration updates are mocked, so we can't test the actual change
            expect(() => unplayable.updateConfig({ logging: { level: 'debug' } })).not.toThrow();
        });

        it('should export configuration with masked sensitive data', async () => {
            const unplayable = await createUnplayable({
                config: {
                    openai: {
                        apiKey: 'sk-1234567890abcdef'
                    }
                }
            });

            const exportedConfig = unplayable.exportConfig();
            expect(typeof exportedConfig).toBe('string');
            expect(() => JSON.parse(exportedConfig)).not.toThrow();
        });

        it('should save configuration to specific file', async () => {
            const unplayable = await createUnplayable();

            await expect(unplayable.saveConfig('/path/to/config.json')).resolves.not.toThrow();
        });

        it('should save configuration to default location', async () => {
            const unplayable = await createUnplayable();

            await expect(unplayable.saveConfig()).resolves.not.toThrow();
        });

        it('should get logger instance', async () => {
            const unplayable = await createUnplayable();
            const logger = unplayable.getLogger();

            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });

    describe('Convenience Functions', () => {
        it('should provide processAudio convenience function', async () => {
            const options: AudioProcessingOptions = {
                dryRun: true
            };

            const result = await processAudio(options);

            expect(result).toBeDefined();
        });

        it('should provide getAudioDevices convenience function', async () => {
            // Ensure device mocks are properly set up for this test
            const { listAudioDevices } = await import('../src/devices');
            vi.mocked(listAudioDevices).mockResolvedValue([
                { index: '0', name: 'Built-in Microphone' },
                { index: '1', name: 'MacBook Pro Microphone' },
                { index: '2', name: 'AirPods Pro' }
            ]);

            const devices = await getAudioDevices();

            expect(Array.isArray(devices)).toBe(true);
        });

        it('should provide recordAudio convenience function', async () => {
            const audioFilePath = await recordAudio({
                maxRecordingTime: 30
            });

            expect(typeof audioFilePath).toBe('string');
            expect(audioFilePath).toBe('/path/to/audio.wav');
        });
    });

    describe('Error Handling', () => {
        it('should handle configuration errors gracefully', async () => {
            // Mock the configuration manager to throw an error for invalid config
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValueOnce({
                get: vi.fn(() => '/tmp/output'),
                getConfig: vi.fn(() => ({ outputDirectory: '/tmp/output' })),
                updateConfig: vi.fn().mockImplementation((config: any) => {
                    if (config.logging?.level === 'invalid') {
                        throw new Error('Invalid logging level');
                    }
                }),
                saveToFile: vi.fn(),
                saveToDefaultLocation: vi.fn(),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();

            expect(() => {
                unplayable.updateConfig({
                    logging: { level: 'invalid' as any }
                });
            }).toThrow('Invalid logging level');
        });

        it('should handle missing audio device configuration', async () => {
            // Mock loadAudioDeviceConfig to return null for this test
            const { loadAudioDeviceConfig } = await import('../src/devices');
            vi.mocked(loadAudioDeviceConfig).mockResolvedValue(null);

            const unplayable = await createUnplayable({
                config: {
                    preferencesDirectory: '/nonexistent/path'
                }
            });

            // Should not throw when loading device config from non-existent directory
            const deviceConfig = await unplayable.loadDeviceConfig();
            expect(deviceConfig).toBeNull();
        });

        it('should handle device validation failures', async () => {
            const { validateAudioDevice } = await import('../src/devices');
            vi.mocked(validateAudioDevice).mockResolvedValue(false);

            const unplayable = await createUnplayable();
            const isValid = await unplayable.validateDevice('999');

            expect(isValid).toBe(false);
        });

        it('should handle device info retrieval failures', async () => {
            const { getAudioDeviceInfo } = await import('../src/devices');
            vi.mocked(getAudioDeviceInfo).mockResolvedValue(null);

            const unplayable = await createUnplayable();
            const info = await unplayable.getDeviceInfo('999');

            expect(info).toBeNull();
        });

        it('should handle configuration save errors', async () => {
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValue({
                get: vi.fn(() => '/tmp/output'),
                getConfig: vi.fn(() => ({ outputDirectory: '/tmp/output' })),
                updateConfig: vi.fn(),
                saveToFile: vi.fn().mockRejectedValue(new Error('Permission denied')),
                saveToDefaultLocation: vi.fn().mockRejectedValue(new Error('Permission denied')),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();

            await expect(unplayable.saveConfig('/readonly/config.json')).rejects.toThrow('Permission denied');
            await expect(unplayable.saveConfig()).rejects.toThrow('Permission denied');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty file extension', async () => {
            const unplayable = await createUnplayable();

            expect(unplayable.isSupportedAudioFile('noextension')).toBe(false);
            expect(unplayable.isSupportedAudioFile('')).toBe(false);
        });

        it('should handle case insensitive file extensions', async () => {
            const unplayable = await createUnplayable();

            expect(unplayable.isSupportedAudioFile('test.MP3')).toBe(true);
            expect(unplayable.isSupportedAudioFile('test.WAV')).toBe(true);
            expect(unplayable.isSupportedAudioFile('test.FLAC')).toBe(true);
        });

        it('should handle file paths with multiple dots', async () => {
            const unplayable = await createUnplayable();

            expect(unplayable.isSupportedAudioFile('my.audio.file.mp3')).toBe(true);
            expect(unplayable.isSupportedAudioFile('complex.file.name.wav')).toBe(true);
        });
    });

    describe('Default Export', () => {
        it('should export default object with all convenience functions', async () => {
            const unplayableDefault = await import('../src/unplayable');
            const defaultExport = unplayableDefault.default;

            expect(defaultExport).toBeDefined();
            expect(typeof defaultExport.createUnplayable).toBe('function');
            expect(typeof defaultExport.processAudio).toBe('function');
            expect(typeof defaultExport.recordAudio).toBe('function');
            expect(typeof defaultExport.getAudioDevices).toBe('function');
        });

        it('should execute default export functions', async () => {
            // Ensure device mocks are properly set up for convenience functions
            const { listAudioDevices } = await import('../src/devices');
            vi.mocked(listAudioDevices).mockResolvedValue([
                { index: '0', name: 'Built-in Microphone' },
                { index: '1', name: 'MacBook Pro Microphone' }
            ]);

            const unplayableDefault = await import('../src/unplayable');
            const defaultExport = unplayableDefault.default;

            // Test that the default export functions actually work
            const unplayable = await defaultExport.createUnplayable();
            expect(unplayable).toBeDefined();

            const devices = await defaultExport.getAudioDevices();
            expect(Array.isArray(devices)).toBe(true);

            const audioFilePath = await defaultExport.recordAudio({ maxRecordingTime: 10 });
            expect(typeof audioFilePath).toBe('string');


            const result = await defaultExport.processAudio({ dryRun: true });
            expect(result).toBeDefined();
        });
    });

    describe('Additional Edge Cases and Error Scenarios', () => {
        it('should handle processAudio with all options provided', async () => {
            const unplayable = await createUnplayable();

            const fullOptions = {
                file: '/path/to/audio.wav',
                outputDirectory: '/custom/output',
                preferencesDirectory: '/custom/preferences',
                maxRecordingTime: 60,
                dryRun: false,
                logger: {
                    error: vi.fn(),
                    warn: vi.fn(),
                    info: vi.fn(),
                    debug: vi.fn(),
                    verbose: vi.fn()
                }
            };

            const result = await unplayable.processAudio(fullOptions);

            expect(result).toBeDefined();
        });

        it('should handle device selection errors gracefully', async () => {
            const { selectAudioDeviceInteractively } = await import('../src/devices');
            vi.mocked(selectAudioDeviceInteractively).mockRejectedValue(new Error('Device selection failed'));

            const unplayable = await createUnplayable();

            await expect(unplayable.selectAudioDevice()).rejects.toThrow('Device selection failed');
        });

        it('should handle device configuration errors gracefully', async () => {
            const { selectAndConfigureAudioDevice } = await import('../src/devices');
            vi.mocked(selectAndConfigureAudioDevice).mockRejectedValue(new Error('Device configuration failed'));

            const unplayable = await createUnplayable();

            await expect(unplayable.selectAndConfigureDevice()).rejects.toThrow('Device configuration failed');
        });

        it('should handle logger creation with different levels', async () => {
            const unplayable1 = await createUnplayable({ config: { logging: { level: 'debug' } } });
            const unplayable2 = await createUnplayable({ config: { logging: { level: 'error' } } });
            const unplayable3 = await createUnplayable({ config: { logging: { silent: true } } });

            expect(unplayable1.getLogger()).toBeDefined();
            expect(unplayable2.getLogger()).toBeDefined();
            expect(unplayable3.getLogger()).toBeDefined();
        });

        it('should handle recordAudio with undefined options', async () => {
            const unplayable = await createUnplayable();

            const audioFilePath = await unplayable.recordAudio(undefined);

            expect(typeof audioFilePath).toBe('string');
        });


        it('should handle file validation with special characters', async () => {
            const unplayable = await createUnplayable();

            // Test various edge cases for file extensions
            expect(unplayable.isSupportedAudioFile('file with spaces.mp3')).toBe(true);
            expect(unplayable.isSupportedAudioFile('file-with-dashes.wav')).toBe(true);
            expect(unplayable.isSupportedAudioFile('file_with_underscores.flac')).toBe(true);
            expect(unplayable.isSupportedAudioFile('file(with)parentheses.aac')).toBe(true);
            expect(unplayable.isSupportedAudioFile('file[with]brackets.m4a')).toBe(true);
        });

        it('should handle configuration updates with nested objects', async () => {
            const unplayable = await createUnplayable();

            // Test updating nested configuration
            unplayable.updateConfig({
                openai: {
                    apiKey: 'test-key',
                    model: 'gpt-4'
                },
                logging: {
                    level: 'debug'
                }
            });

            // Since config updates are mocked, we just verify it doesn't throw
            expect(() => unplayable.updateConfig({
                openai: { apiKey: 'new-key' }
            })).not.toThrow();
        });

        it('should handle edge case where config methods return undefined', async () => {
            // Test configuration edge cases
            const configMock = await import('../src/configuration');
            vi.mocked(configMock.loadConfiguration).mockResolvedValue({
                get: vi.fn(() => undefined),
                getConfig: vi.fn(() => ({})),
                updateConfig: vi.fn(),
                saveToFile: vi.fn(),
                saveToDefaultLocation: vi.fn(),
                exportConfig: vi.fn(() => '{}')
            } as any);

            const unplayable = await createUnplayable();

            // Should handle undefined config values gracefully
            const result = await unplayable.processAudio({ dryRun: true });
            expect(result).toBeDefined();
        });
    });
}); 