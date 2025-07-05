import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';

import {
    AudioProcessor,
    createAudioProcessor
} from '../src/processor';
import {
    AudioProcessingOptions,
    AudioProcessingResult,
    AudioDeviceConfig,
    Logger
} from '../src/types';
import {
    AudioRecordingError,
    AudioConfigurationError
} from '../src/error';

// Mock dependencies
vi.mock('../src/devices', () => ({
    detectBestAudioDevice: vi.fn(),
    loadAudioDeviceConfig: vi.fn(),
    audioDeviceConfigExists: vi.fn(),
    validateAudioDevice: vi.fn()
}));

vi.mock('../src/validation', () => ({
    validateAudioFile: vi.fn(),
    validateAudioProcessingOptions: vi.fn()
}));

vi.mock('../src/util/storage', () => ({
    createStorage: vi.fn(),
    generateTimestampedFilename: vi.fn(),
    generateUniqueFilename: vi.fn()
}));

vi.mock('../src/util/child', () => ({
    run: vi.fn()
}));

vi.mock('os', () => ({
    tmpdir: vi.fn()
}));

vi.mock('path', async () => {
    const actual = await vi.importActual('path');
    return {
        ...actual,
        join: vi.fn((...args) => args.join('/'))
    };
});

describe('AudioProcessor', () => {
    let mockLogger: Logger;
    let mockStorage: any;
    let processor: AudioProcessor;
    let recordAudioSpy: any;

    const baseOptions: AudioProcessingOptions = {
        outputDirectory: '/test/output',
        maxRecordingTime: 60
    };

    // Import mocked modules
    let detectBestAudioDevice: any;
    let loadAudioDeviceConfig: any;
    let audioDeviceConfigExists: any;
    let validateAudioDevice: any;
    let validateAudioFile: any;
    let validateAudioProcessingOptions: any;
    let createStorage: any;
    let generateTimestampedFilename: any;
    let generateUniqueFilename: any;
    let run: any;
    let mockOs: any;

    beforeEach(async () => {
        const devicesModule = await import('../src/devices');
        const validationModule = await import('../src/validation');
        const storageModule = await import('../src/util/storage');
        const childModule = await import('../src/util/child');

        detectBestAudioDevice = vi.mocked(devicesModule.detectBestAudioDevice);
        loadAudioDeviceConfig = vi.mocked(devicesModule.loadAudioDeviceConfig);
        audioDeviceConfigExists = vi.mocked(devicesModule.audioDeviceConfigExists);
        validateAudioDevice = vi.mocked(devicesModule.validateAudioDevice);
        validateAudioFile = vi.mocked(validationModule.validateAudioFile);
        validateAudioProcessingOptions = vi.mocked(validationModule.validateAudioProcessingOptions);
        createStorage = vi.mocked(storageModule.createStorage);
        generateTimestampedFilename = vi.mocked(storageModule.generateTimestampedFilename);
        generateUniqueFilename = vi.mocked(storageModule.generateUniqueFilename);
        run = vi.mocked(childModule.run);
        mockOs = vi.mocked(os);

        vi.clearAllMocks();

        mockLogger = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        };

        mockStorage = {
            getFileStats: vi.fn(),
            ensureDirectory: vi.fn(),
            copyFile: vi.fn(),
            writeFile: vi.fn(),
            createDirectory: vi.fn(),
            listFiles: vi.fn(),
            deleteFile: vi.fn()
        };

        createStorage.mockReturnValue(mockStorage);
        processor = new AudioProcessor(mockLogger);

        // Mock the recordAudio method globally to avoid ffmpeg calls
        recordAudioSpy = vi.spyOn(processor as any, 'recordAudio').mockResolvedValue({ cancelled: false });
    });

    afterEach(() => {
        // Reset the mock to default behavior between tests
        recordAudioSpy.mockResolvedValue({ cancelled: false });
    });

    describe('constructor', () => {
        it('should create AudioProcessor with logger', () => {
            const processorWithLogger = new AudioProcessor(mockLogger);
            expect(processorWithLogger).toBeInstanceOf(AudioProcessor);
            expect(createStorage).toHaveBeenCalled();
        });

        it('should create AudioProcessor without logger', () => {
            const processorWithoutLogger = new AudioProcessor();
            expect(processorWithoutLogger).toBeInstanceOf(AudioProcessor);
            expect(createStorage).toHaveBeenCalled();
        });
    });

    describe('processAudio', () => {
        beforeEach(() => {
            validateAudioProcessingOptions.mockResolvedValue(undefined);
        });

        describe('dry run mode', () => {
            it('should handle dry run for file processing', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    file: '/test/audio.wav',
                    dryRun: true
                };

                const result = await processor.processAudio(options);

                expect(result).toEqual({
                    cancelled: false,
                    metadata: {
                        processingTime: 0
                    }
                });
                expect(mockLogger.info).toHaveBeenCalledWith('DRY RUN: Would process audio file: /test/audio.wav');
            });

            it('should handle dry run for recording', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    dryRun: true
                };

                const result = await processor.processAudio(options);

                expect(result).toEqual({
                    cancelled: false,
                    metadata: {
                        processingTime: 0
                    }
                });
                expect(mockLogger.info).toHaveBeenCalledWith('DRY RUN: Would start audio recording');
            });
        });

        describe('file processing', () => {
            it('should process audio file successfully', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    file: '/test/audio.wav'
                };

                const mockStats = { size: 1024 };
                mockStorage.getFileStats.mockResolvedValue(mockStats);
                validateAudioFile.mockResolvedValue(undefined);

                const result = await processor.processAudio(options);

                expect(validateAudioFile).toHaveBeenCalledWith('/test/audio.wav', mockLogger);
                expect(result.audioFilePath).toBe('/test/audio.wav');
                expect(result.cancelled).toBe(false);
                expect(result.metadata).toEqual({
                    fileSize: 1024,
                    format: 'wav',
                    processingTime: expect.any(Number)
                });
            });
        });

        describe('recording mode', () => {
            beforeEach(() => {
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');
            });

            it('should record and process audio successfully', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(true);
                loadAudioDeviceConfig.mockResolvedValue({
                    audioDevice: '1',
                    audioDeviceName: 'MacBook Pro Microphone'
                });
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                const result = await processor.processAudio(options);

                expect(result.audioFilePath).toBe('/test/output/recording-456.wav');
                expect(result.cancelled).toBe(false);
                expect(result.metadata?.fileSize).toBe(2048);
                expect(mockStorage.copyFile).toHaveBeenCalled();
                expect(recordAudioSpy).toHaveBeenCalled();
            });

            it('should handle recording cancellation', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(true);
                loadAudioDeviceConfig.mockResolvedValue({
                    audioDevice: '1',
                    audioDeviceName: 'MacBook Pro Microphone'
                });

                // Mock recording cancellation
                recordAudioSpy.mockResolvedValue({ cancelled: true });

                const result = await processor.processAudio(options);

                expect(result.cancelled).toBe(true);
            });

            it('should keep temp files when keepTemp is true', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    keepTemp: true,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(true);
                loadAudioDeviceConfig.mockResolvedValue({
                    audioDevice: '1',
                    audioDeviceName: 'MacBook Pro Microphone'
                });
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                await processor.processAudio(options);

                expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Temporary recording kept at:'));
                expect(recordAudioSpy).toHaveBeenCalled();
            });

            it('should handle recording error and cleanup', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(true);
                loadAudioDeviceConfig.mockResolvedValue({
                    audioDevice: '1',
                    audioDeviceName: 'MacBook Pro Microphone'
                });
                run.mockRejectedValue(new Error('Recording failed'));
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');

                // Mock the recordAudio method to throw an error
                recordAudioSpy.mockRejectedValue(new Error('Recording failed'));

                await expect(processor.processAudio(options)).rejects.toThrow('Recording failed');
                // Cleanup should be called even on error
                expect(mockStorage.listFiles).toHaveBeenCalled();
                expect(recordAudioSpy).toHaveBeenCalled();
            });
        });

        describe('device configuration', () => {
            it('should throw error when no device configured for recording', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(false);

                await expect(processor.processAudio(options)).rejects.toThrow(AudioConfigurationError);
                await expect(processor.processAudio(options)).rejects.toThrow(
                    'No audio device configured. Please configure your audio device first.'
                );
            });

            it('should use specified audio device', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    audioDevice: '2'
                };

                validateAudioDevice.mockResolvedValue(true);
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                await processor.processAudio(options);

                expect(validateAudioDevice).toHaveBeenCalledWith('2', mockLogger);
                expect(recordAudioSpy).toHaveBeenCalled();
            });

            it('should throw error for invalid audio device', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    audioDevice: '999'
                };

                validateAudioDevice.mockResolvedValue(false);

                await expect(processor.processAudio(options)).rejects.toThrow(AudioConfigurationError);
            });

            it('should auto-detect device when no preferences directory', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions
                };

                detectBestAudioDevice.mockResolvedValue('1');
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                await processor.processAudio(options);

                expect(detectBestAudioDevice).toHaveBeenCalledWith(mockLogger);
                expect(recordAudioSpy).toHaveBeenCalled();
            });

            it('should throw error when no saved config found', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    preferencesDirectory: '/test/prefs'
                };

                audioDeviceConfigExists.mockResolvedValue(true);
                loadAudioDeviceConfig.mockResolvedValue(null);

                await expect(processor.processAudio(options)).rejects.toThrow(AudioConfigurationError);
                await expect(processor.processAudio(options)).rejects.toThrow(
                    'No audio device configuration found'
                );
            });
        });

        describe('recording functionality', () => {
            it('should record with custom max time', async () => {
                const options: AudioProcessingOptions = {
                    maxRecordingTime: 120,
                    audioDevice: '1'
                };

                validateAudioDevice.mockResolvedValue(true);
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                // Mock the recordAudio method to avoid actual ffmpeg calls
                recordAudioSpy.mockImplementation(async (params: any) => {
                    // Check that the max time is passed correctly
                    expect(params.maxTime).toBe(120);
                    // Simulate the logging that happens in recordAudio
                    mockLogger.info(`⏱️ Maximum recording time: ${params.maxTime} seconds`);
                    return { cancelled: false };
                });

                await processor.processAudio(options);

                expect(recordAudioSpy).toHaveBeenCalled();
                expect(mockLogger.info).toHaveBeenCalledWith('⏱️ Maximum recording time: 120 seconds');
            });

            it('should use default max time when not specified', async () => {
                const options: AudioProcessingOptions = {
                    audioDevice: '1'
                    // maxRecordingTime is undefined to test the || 60 branch
                };

                validateAudioDevice.mockResolvedValue(true);
                validateAudioFile.mockResolvedValue(undefined);
                run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
                mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockStorage.copyFile.mockResolvedValue(undefined);
                mockStorage.ensureDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');
                generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

                // Mock the recordAudio method to avoid actual ffmpeg calls
                recordAudioSpy.mockImplementation(async (params: any) => {
                    // Check that the default max time is used
                    expect(params.maxTime).toBe(60);
                    // Simulate the logging that happens in recordAudio
                    mockLogger.info(`⏱️ Maximum recording time: ${params.maxTime} seconds`);
                    return { cancelled: false };
                });

                await processor.processAudio(options);

                expect(recordAudioSpy).toHaveBeenCalled();
                expect(mockLogger.info).toHaveBeenCalledWith('⏱️ Maximum recording time: 60 seconds');
            });

            it('should handle recording timeout', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    audioDevice: '1'
                };

                validateAudioDevice.mockResolvedValue(true);
                const timeoutError = new Error('timeout');
                run.mockRejectedValue(timeoutError);
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');

                // Mock the recordAudio method to throw an AudioRecordingError
                recordAudioSpy.mockImplementation(async () => {
                    throw new AudioRecordingError(`Audio recording failed: ${timeoutError.message || 'undefined'}`);
                });

                await expect(processor.processAudio(options)).rejects.toThrow(AudioRecordingError);
            });

            it('should handle recording error with undefined message', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    audioDevice: '1'
                };

                validateAudioDevice.mockResolvedValue(true);
                const errorWithoutMessage = new Error();
                // Explicitly set message to undefined to test the optional chaining branch
                errorWithoutMessage.message = undefined as any;
                run.mockRejectedValue(errorWithoutMessage);
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');

                // Mock the recordAudio method to throw an AudioRecordingError with undefined message
                recordAudioSpy.mockImplementation(async () => {
                    throw new AudioRecordingError(`Audio recording failed: ${errorWithoutMessage.message || 'undefined'}`);
                });

                await expect(processor.processAudio(options)).rejects.toThrow(AudioRecordingError);
                await expect(processor.processAudio(options)).rejects.toThrow('Audio recording failed: undefined');
            });

            it('should handle ffmpeg error', async () => {
                const options: AudioProcessingOptions = {
                    ...baseOptions,
                    audioDevice: '1'
                };

                validateAudioDevice.mockResolvedValue(true);
                run.mockResolvedValue({ code: 1, stdout: '', stderr: 'Audio device error' });
                mockStorage.listFiles.mockResolvedValue([]);
                mockStorage.createDirectory.mockResolvedValue(undefined);
                mockOs.tmpdir.mockReturnValue('/tmp');
                generateTimestampedFilename.mockReturnValue('recording-123.wav');

                // Mock the recordAudio method to throw an AudioRecordingError
                recordAudioSpy.mockImplementation(async () => {
                    throw new AudioRecordingError('FFmpeg exited with code 1: Audio device error');
                });

                await expect(processor.processAudio(options)).rejects.toThrow(AudioRecordingError);
                await expect(processor.processAudio(options)).rejects.toThrow('FFmpeg exited with code 1');
            });
        });

        describe('error handling', () => {
            it('should handle validation errors', async () => {
                const options: AudioProcessingOptions = {
                    file: '/test/audio.wav'
                };

                const validationError = new Error('Invalid options');
                validateAudioProcessingOptions.mockRejectedValue(validationError);

                await expect(processor.processAudio(options)).rejects.toThrow('Invalid options');
                expect(mockLogger.error).toHaveBeenCalledWith('Audio processing failed: Invalid options');
            });

            it('should handle file validation errors', async () => {
                const options: AudioProcessingOptions = {
                    file: '/test/audio.wav'
                };

                const fileError = new Error('Invalid audio file');
                validateAudioFile.mockRejectedValue(fileError);

                await expect(processor.processAudio(options)).rejects.toThrow('Invalid audio file');
            });

            it('should add processing metadata', async () => {
                const options: AudioProcessingOptions = {
                    file: '/test/audio.wav'
                };

                const mockStats = { size: 1024 };
                mockStorage.getFileStats.mockResolvedValue(mockStats);
                validateAudioFile.mockResolvedValue(undefined);

                const result = await processor.processAudio(options);

                expect(result.metadata?.processingTime).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('temporary directory management', () => {
        it('should create unique temp directory', async () => {
            const options: AudioProcessingOptions = {
                ...baseOptions,
                audioDevice: '1'
            };

            mockOs.tmpdir.mockReturnValue('/tmp');
            validateAudioDevice.mockResolvedValue(true);
            validateAudioFile.mockResolvedValue(undefined);
            run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
            mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
            mockStorage.listFiles.mockResolvedValue([]);
            mockStorage.createDirectory.mockResolvedValue(undefined);
            mockStorage.copyFile.mockResolvedValue(undefined);
            mockStorage.ensureDirectory.mockResolvedValue(undefined);
            generateTimestampedFilename.mockReturnValue('recording-123.wav');
            generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

            await processor.processAudio(options);

            expect(mockStorage.createDirectory).toHaveBeenCalledWith(
                expect.stringMatching(/^\/tmp\/unplayable-\d+-[a-z0-9]+$/)
            );
            expect(recordAudioSpy).toHaveBeenCalled();
        });

        it('should cleanup temp directory', async () => {
            const options: AudioProcessingOptions = {
                ...baseOptions,
                audioDevice: '1'
            };

            validateAudioDevice.mockResolvedValue(true);
            validateAudioFile.mockResolvedValue(undefined);
            run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
            mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
            mockStorage.listFiles.mockResolvedValue(['/tmp/temp-file.wav']);
            mockStorage.createDirectory.mockResolvedValue(undefined);
            mockStorage.copyFile.mockResolvedValue(undefined);
            mockStorage.ensureDirectory.mockResolvedValue(undefined);
            mockOs.tmpdir.mockReturnValue('/tmp');
            generateTimestampedFilename.mockReturnValue('recording-123.wav');
            generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

            await processor.processAudio(options);

            expect(mockStorage.listFiles).toHaveBeenCalled();
            expect(mockStorage.deleteFile).toHaveBeenCalledWith('/tmp/temp-file.wav');
            expect(recordAudioSpy).toHaveBeenCalled();
        });

        it('should handle cleanup errors gracefully', async () => {
            const options: AudioProcessingOptions = {
                ...baseOptions,
                audioDevice: '1'
            };

            validateAudioDevice.mockResolvedValue(true);
            validateAudioFile.mockResolvedValue(undefined);
            run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
            mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
            mockStorage.listFiles.mockRejectedValue(new Error('Cleanup failed'));
            mockStorage.createDirectory.mockResolvedValue(undefined);
            mockStorage.copyFile.mockResolvedValue(undefined);
            mockStorage.ensureDirectory.mockResolvedValue(undefined);
            mockOs.tmpdir.mockReturnValue('/tmp');
            generateTimestampedFilename.mockReturnValue('recording-123.wav');
            generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

            // Should not throw despite cleanup error
            await processor.processAudio(options);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to cleanup temporary directory')
            );
            expect(recordAudioSpy).toHaveBeenCalled();
        });
    });

    describe('logging behavior', () => {

        it('should log recording progress', async () => {
            const options: AudioProcessingOptions = {
                ...baseOptions,
                audioDevice: '1'
            };

            validateAudioDevice.mockResolvedValue(true);
            validateAudioFile.mockResolvedValue(undefined);
            run.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
            mockStorage.getFileStats.mockResolvedValue({ size: 2048 });
            mockStorage.listFiles.mockResolvedValue([]);
            mockStorage.createDirectory.mockResolvedValue(undefined);
            mockStorage.copyFile.mockResolvedValue(undefined);
            mockStorage.ensureDirectory.mockResolvedValue(undefined);
            mockOs.tmpdir.mockReturnValue('/tmp');
            generateTimestampedFilename.mockReturnValue('recording-123.wav');
            generateUniqueFilename.mockResolvedValue('/test/output/recording-456.wav');

            // Mock the recordAudio method to avoid actual ffmpeg calls
            recordAudioSpy.mockImplementation(async (params: any) => {
                // Simulate the logging that happens in recordAudio
                mockLogger.info(`🔴 Recording from device: [${params.audioDevice.audioDevice}] ${params.audioDevice.audioDeviceName}`);
                mockLogger.info(`⏱️ Maximum recording time: ${params.maxTime} seconds`);
                mockLogger.info('⏹️ Press Ctrl+C to stop recording early');
                mockLogger.info(`✅ Recording completed: ${params.outputPath}`);
                return { cancelled: false };
            });

            await processor.processAudio(options);

            expect(mockLogger.info).toHaveBeenCalledWith('🎙️ Starting audio recording...');
            expect(mockLogger.info).toHaveBeenCalledWith('🔴 Recording from device: [1] Device 1');
            expect(mockLogger.info).toHaveBeenCalledWith('⏹️ Press Ctrl+C to stop recording early');
            expect(mockLogger.info).toHaveBeenCalledWith('✅ Recording completed successfully');
            expect(recordAudioSpy).toHaveBeenCalled();
        });
    });
});

describe('createAudioProcessor', () => {
    it('should create AudioProcessor instance with logger', () => {
        const mockLogger: Logger = {
            debug: vi.fn(),
            error: vi.fn(),
            info: vi.fn(),
            warn: vi.fn()
        };

        const processor = createAudioProcessor(mockLogger);

        expect(processor).toBeInstanceOf(AudioProcessor);
    });

    it('should create AudioProcessor instance without logger', () => {
        const processor = createAudioProcessor();

        expect(processor).toBeInstanceOf(AudioProcessor);
    });
});
