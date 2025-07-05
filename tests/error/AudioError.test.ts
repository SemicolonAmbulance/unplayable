/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';

import {
    AudioDeviceError,
    AudioRecordingError,
    AudioProcessingError,
    AudioConfigurationError
} from '../../src/error/AudioError';
import { UnplayableError } from '../../src/error/UnplayableError';

describe('AudioError', () => {
    describe('AudioDeviceError', () => {
        describe('constructor', () => {
            it('should create an AudioDeviceError with message and code', () => {
                const error = new AudioDeviceError('Device error message');

                expect(error).toBeInstanceOf(AudioDeviceError);
                expect(error).toBeInstanceOf(UnplayableError);
                expect(error).toBeInstanceOf(Error);
                expect(error.name).toBe('AudioDeviceError');
                expect(error.message).toBe('Device error message');
                expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                expect(error.details).toBeUndefined();
            });

            it('should create an AudioDeviceError with message, code, and details', () => {
                const details = { deviceIndex: '1', reason: 'permission denied' };
                const error = new AudioDeviceError('Device error message', details);

                expect(error.name).toBe('AudioDeviceError');
                expect(error.message).toBe('Device error message');
                expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                expect(error.details).toEqual(details);
            });

            it('should have proper stack trace', () => {
                const error = new AudioDeviceError('Test error');
                expect(error.stack).toBeDefined();
                expect(error.stack).toContain('AudioDeviceError');
            });
        });

        describe('static methods', () => {
            describe('deviceNotFound', () => {
                it('should create an error for device not found', () => {
                    const error = AudioDeviceError.deviceNotFound('2');

                    expect(error).toBeInstanceOf(AudioDeviceError);
                    expect(error.message).toBe('Audio device not found: 2');
                    expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                    expect(error.details).toEqual({ deviceIndex: '2' });
                });
            });

            describe('deviceNotAccessible', () => {
                it('should create an error for device not accessible without reason', () => {
                    const error = AudioDeviceError.deviceNotAccessible('1');

                    expect(error).toBeInstanceOf(AudioDeviceError);
                    expect(error.message).toBe('Audio device not accessible: 1');
                    expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                    expect(error.details).toEqual({ deviceIndex: '1', reason: undefined });
                });

                it('should create an error for device not accessible with reason', () => {
                    const error = AudioDeviceError.deviceNotAccessible('1', 'permission denied');

                    expect(error).toBeInstanceOf(AudioDeviceError);
                    expect(error.message).toBe('Audio device not accessible: 1 (permission denied)');
                    expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                    expect(error.details).toEqual({ deviceIndex: '1', reason: 'permission denied' });
                });
            });

            describe('noDevicesAvailable', () => {
                it('should create an error for no devices available', () => {
                    const error = AudioDeviceError.noDevicesAvailable();

                    expect(error).toBeInstanceOf(AudioDeviceError);
                    expect(error.message).toBe('No audio devices available');
                    expect(error.code).toBe('AUDIO_DEVICE_ERROR');
                    expect(error.details).toBeUndefined();
                });
            });
        });

        describe('JSON serialization', () => {
            it('should serialize to JSON properly', () => {
                const error = AudioDeviceError.deviceNotFound('1');
                const json = error.toJSON();

                expect(json).toEqual({
                    name: 'AudioDeviceError',
                    message: 'Audio device not found: 1',
                    code: 'AUDIO_DEVICE_ERROR',
                    details: { deviceIndex: '1' },
                    stack: expect.any(String)
                });
            });
        });
    });

    describe('AudioRecordingError', () => {
        describe('constructor', () => {
            it('should create an AudioRecordingError with message and code', () => {
                const error = new AudioRecordingError('Recording error message');

                expect(error).toBeInstanceOf(AudioRecordingError);
                expect(error).toBeInstanceOf(UnplayableError);
                expect(error).toBeInstanceOf(Error);
                expect(error.name).toBe('AudioRecordingError');
                expect(error.message).toBe('Recording error message');
                expect(error.code).toBe('AUDIO_RECORDING_ERROR');
                expect(error.details).toBeUndefined();
            });

            it('should create an AudioRecordingError with message, code, and details', () => {
                const details = { duration: 30, reason: 'interrupted' };
                const error = new AudioRecordingError('Recording error message', details);

                expect(error.name).toBe('AudioRecordingError');
                expect(error.message).toBe('Recording error message');
                expect(error.code).toBe('AUDIO_RECORDING_ERROR');
                expect(error.details).toEqual(details);
            });
        });

        describe('static methods', () => {
            describe('recordingFailed', () => {
                it('should create an error for recording failed', () => {
                    const error = AudioRecordingError.recordingFailed('microphone disconnected');

                    expect(error).toBeInstanceOf(AudioRecordingError);
                    expect(error.message).toBe('Audio recording failed: microphone disconnected');
                    expect(error.code).toBe('AUDIO_RECORDING_ERROR');
                    expect(error.details).toEqual({ reason: 'microphone disconnected' });
                });
            });

            describe('recordingTimeout', () => {
                it('should create an error for recording timeout', () => {
                    const error = AudioRecordingError.recordingTimeout(60);

                    expect(error).toBeInstanceOf(AudioRecordingError);
                    expect(error.message).toBe('Recording timed out after 60 seconds');
                    expect(error.code).toBe('AUDIO_RECORDING_ERROR');
                    expect(error.details).toEqual({ maxTime: 60 });
                });
            });

            describe('recordingCancelled', () => {
                it('should create an error for recording cancelled', () => {
                    const error = AudioRecordingError.recordingCancelled();

                    expect(error).toBeInstanceOf(AudioRecordingError);
                    expect(error.message).toBe('Recording was cancelled by user');
                    expect(error.code).toBe('AUDIO_RECORDING_ERROR');
                    expect(error.details).toBeUndefined();
                });
            });
        });

        describe('JSON serialization', () => {
            it('should serialize to JSON properly', () => {
                const error = AudioRecordingError.recordingTimeout(30);
                const json = error.toJSON();

                expect(json).toEqual({
                    name: 'AudioRecordingError',
                    message: 'Recording timed out after 30 seconds',
                    code: 'AUDIO_RECORDING_ERROR',
                    details: { maxTime: 30 },
                    stack: expect.any(String)
                });
            });
        });
    });

    describe('AudioProcessingError', () => {
        describe('constructor', () => {
            it('should create an AudioProcessingError with message and code', () => {
                const error = new AudioProcessingError('Processing error message');

                expect(error).toBeInstanceOf(AudioProcessingError);
                expect(error).toBeInstanceOf(UnplayableError);
                expect(error).toBeInstanceOf(Error);
                expect(error.name).toBe('AudioProcessingError');
                expect(error.message).toBe('Processing error message');
                expect(error.code).toBe('AUDIO_PROCESSING_ERROR');
                expect(error.details).toBeUndefined();
            });

            it('should create an AudioProcessingError with message, code, and details', () => {
                const details = { filePath: '/test/audio.wav', fileSize: 1024 };
                const error = new AudioProcessingError('Processing error message', details);

                expect(error.name).toBe('AudioProcessingError');
                expect(error.message).toBe('Processing error message');
                expect(error.code).toBe('AUDIO_PROCESSING_ERROR');
                expect(error.details).toEqual(details);
            });
        });

        describe('static methods', () => {
            describe('fileNotFound', () => {
                it('should create an error for file not found', () => {
                    const error = AudioProcessingError.fileNotFound('/path/to/audio.wav');

                    expect(error).toBeInstanceOf(AudioProcessingError);
                    expect(error.message).toBe('Audio file not found: /path/to/audio.wav');
                    expect(error.code).toBe('AUDIO_PROCESSING_ERROR');
                    expect(error.details).toEqual({ filePath: '/path/to/audio.wav' });
                });
            });

            describe('unsupportedFormat', () => {
                it('should create an error for unsupported format', () => {
                    const error = AudioProcessingError.unsupportedFormat('ogg');

                    expect(error).toBeInstanceOf(AudioProcessingError);
                    expect(error.message).toBe('Unsupported audio format: ogg');
                    expect(error.code).toBe('AUDIO_PROCESSING_ERROR');
                    expect(error.details).toEqual({ format: 'ogg' });
                });
            });

            describe('emptyFile', () => {
                it('should create an error for empty file', () => {
                    const error = AudioProcessingError.emptyFile('/path/to/empty.wav');

                    expect(error).toBeInstanceOf(AudioProcessingError);
                    expect(error.message).toBe('Audio file is empty: /path/to/empty.wav');
                    expect(error.code).toBe('AUDIO_PROCESSING_ERROR');
                    expect(error.details).toEqual({ filePath: '/path/to/empty.wav' });
                });
            });
        });

        describe('JSON serialization', () => {
            it('should serialize to JSON properly', () => {
                const error = AudioProcessingError.fileNotFound('/test/audio.wav');
                const json = error.toJSON();

                expect(json).toEqual({
                    name: 'AudioProcessingError',
                    message: 'Audio file not found: /test/audio.wav',
                    code: 'AUDIO_PROCESSING_ERROR',
                    details: { filePath: '/test/audio.wav' },
                    stack: expect.any(String)
                });
            });
        });
    });

    describe('AudioConfigurationError', () => {
        describe('constructor', () => {
            it('should create an AudioConfigurationError with message and code', () => {
                const error = new AudioConfigurationError('Configuration error message');

                expect(error).toBeInstanceOf(AudioConfigurationError);
                expect(error).toBeInstanceOf(UnplayableError);
                expect(error).toBeInstanceOf(Error);
                expect(error.name).toBe('AudioConfigurationError');
                expect(error.message).toBe('Configuration error message');
                expect(error.code).toBe('AUDIO_CONFIGURATION_ERROR');
                expect(error.details).toBeUndefined();
            });

            it('should create an AudioConfigurationError with message, code, and details', () => {
                const details = { configField: 'apiKey', configValue: 'invalid' };
                const error = new AudioConfigurationError('Configuration error message', details);

                expect(error.name).toBe('AudioConfigurationError');
                expect(error.message).toBe('Configuration error message');
                expect(error.code).toBe('AUDIO_CONFIGURATION_ERROR');
                expect(error.details).toEqual(details);
            });
        });

        describe('static methods', () => {
            describe('invalidConfig', () => {
                it('should create an error for invalid config', () => {
                    const error = AudioConfigurationError.invalidConfig('maxRecordingTime', -5);

                    expect(error).toBeInstanceOf(AudioConfigurationError);
                    expect(error.message).toBe('Invalid configuration for maxRecordingTime: -5');
                    expect(error.code).toBe('AUDIO_CONFIGURATION_ERROR');
                    expect(error.details).toEqual({ field: 'maxRecordingTime', value: -5 });
                });

                it('should handle null values', () => {
                    const error = AudioConfigurationError.invalidConfig('apiKey', null);

                    expect(error.message).toBe('Invalid configuration for apiKey: null');
                    expect(error.details).toEqual({ field: 'apiKey', value: null });
                });

                it('should handle undefined values', () => {
                    const error = AudioConfigurationError.invalidConfig('outputDirectory', undefined);

                    expect(error.message).toBe('Invalid configuration for outputDirectory: undefined');
                    expect(error.details).toEqual({ field: 'outputDirectory', value: undefined });
                });

                it('should handle object values', () => {
                    const invalidObject = { nested: 'value' };
                    const error = AudioConfigurationError.invalidConfig('settings', invalidObject);

                    expect(error.message).toBe('Invalid configuration for settings: [object Object]');
                    expect(error.details).toEqual({ field: 'settings', value: invalidObject });
                });
            });

            describe('missingConfig', () => {
                it('should create an error for missing config', () => {
                    const error = AudioConfigurationError.missingConfig('apiKey');

                    expect(error).toBeInstanceOf(AudioConfigurationError);
                    expect(error.message).toBe('Missing required configuration: apiKey');
                    expect(error.code).toBe('AUDIO_CONFIGURATION_ERROR');
                    expect(error.details).toEqual({ field: 'apiKey' });
                });
            });
        });

        describe('JSON serialization', () => {
            it('should serialize to JSON properly', () => {
                const error = AudioConfigurationError.missingConfig('apiKey');
                const json = error.toJSON();

                expect(json).toEqual({
                    name: 'AudioConfigurationError',
                    message: 'Missing required configuration: apiKey',
                    code: 'AUDIO_CONFIGURATION_ERROR',
                    details: { field: 'apiKey' },
                    stack: expect.any(String)
                });
            });
        });
    });

    describe('Error inheritance chain', () => {
        it('should properly inherit from UnplayableError and Error', () => {
            const deviceError = new AudioDeviceError('test');
            const recordingError = new AudioRecordingError('test');
            const processingError = new AudioProcessingError('test');
            const configError = new AudioConfigurationError('test');

            // Check instanceof chain
            expect(deviceError instanceof AudioDeviceError).toBe(true);
            expect(deviceError instanceof UnplayableError).toBe(true);
            expect(deviceError instanceof Error).toBe(true);

            expect(recordingError instanceof AudioRecordingError).toBe(true);
            expect(recordingError instanceof UnplayableError).toBe(true);
            expect(recordingError instanceof Error).toBe(true);

            expect(processingError instanceof AudioProcessingError).toBe(true);
            expect(processingError instanceof UnplayableError).toBe(true);
            expect(processingError instanceof Error).toBe(true);

            expect(configError instanceof AudioConfigurationError).toBe(true);
            expect(configError instanceof UnplayableError).toBe(true);
            expect(configError instanceof Error).toBe(true);
        });

        it('should maintain proper constructor references', () => {
            const deviceError = new AudioDeviceError('test');
            const recordingError = new AudioRecordingError('test');
            const processingError = new AudioProcessingError('test');
            const configError = new AudioConfigurationError('test');

            expect(deviceError.constructor).toBe(AudioDeviceError);
            expect(recordingError.constructor).toBe(AudioRecordingError);
            expect(processingError.constructor).toBe(AudioProcessingError);
            expect(configError.constructor).toBe(AudioConfigurationError);
        });
    });

    describe('Error codes', () => {
        it('should have unique error codes for each error type', () => {
            const deviceError = new AudioDeviceError('test');
            const recordingError = new AudioRecordingError('test');
            const processingError = new AudioProcessingError('test');
            const configError = new AudioConfigurationError('test');

            const codes = [
                deviceError.code,
                recordingError.code,
                processingError.code,
                configError.code
            ];

            // Check that all codes are unique
            const uniqueCodes = [...new Set(codes)];
            expect(uniqueCodes).toHaveLength(codes.length);

            // Check specific codes
            expect(deviceError.code).toBe('AUDIO_DEVICE_ERROR');
            expect(recordingError.code).toBe('AUDIO_RECORDING_ERROR');
            expect(processingError.code).toBe('AUDIO_PROCESSING_ERROR');
            expect(configError.code).toBe('AUDIO_CONFIGURATION_ERROR');
        });
    });
});
