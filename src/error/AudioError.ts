/* eslint-disable @typescript-eslint/no-explicit-any */
import { UnplayableError } from './UnplayableError';

/**
 * Error thrown when audio device operations fail
 */
export class AudioDeviceError extends UnplayableError {
    constructor(message: string, details?: any) {
        super(message, 'AUDIO_DEVICE_ERROR', details);
        this.name = 'AudioDeviceError';
    }

    static deviceNotFound(deviceIndex: string): AudioDeviceError {
        return new AudioDeviceError(
            `Audio device not found: ${deviceIndex}`,
            { deviceIndex }
        );
    }

    static deviceNotAccessible(deviceIndex: string, reason?: string): AudioDeviceError {
        return new AudioDeviceError(
            `Audio device not accessible: ${deviceIndex}${reason ? ` (${reason})` : ''}`,
            { deviceIndex, reason }
        );
    }

    static noDevicesAvailable(): AudioDeviceError {
        return new AudioDeviceError('No audio devices available');
    }
}

/**
 * Error thrown when audio recording operations fail
 */
export class AudioRecordingError extends UnplayableError {
    constructor(message: string, details?: any) {
        super(message, 'AUDIO_RECORDING_ERROR', details);
        this.name = 'AudioRecordingError';
    }

    static recordingFailed(reason: string): AudioRecordingError {
        return new AudioRecordingError(
            `Audio recording failed: ${reason}`,
            { reason }
        );
    }

    static recordingTimeout(maxTime: number): AudioRecordingError {
        return new AudioRecordingError(
            `Recording timed out after ${maxTime} seconds`,
            { maxTime }
        );
    }

    static recordingCancelled(): AudioRecordingError {
        return new AudioRecordingError('Recording was cancelled by user');
    }
}

/**
 * Error thrown when audio processing operations fail
 */
export class AudioProcessingError extends UnplayableError {
    constructor(message: string, details?: any) {
        super(message, 'AUDIO_PROCESSING_ERROR', details);
        this.name = 'AudioProcessingError';
    }

    static fileNotFound(filePath: string): AudioProcessingError {
        return new AudioProcessingError(
            `Audio file not found: ${filePath}`,
            { filePath }
        );
    }

    static unsupportedFormat(format: string): AudioProcessingError {
        return new AudioProcessingError(
            `Unsupported audio format: ${format}`,
            { format }
        );
    }

    static emptyFile(filePath: string): AudioProcessingError {
        return new AudioProcessingError(
            `Audio file is empty: ${filePath}`,
            { filePath }
        );
    }
}

/**
 * Error thrown when configuration is invalid
 */
export class AudioConfigurationError extends UnplayableError {
    constructor(message: string, details?: any) {
        super(message, 'AUDIO_CONFIGURATION_ERROR', details);
        this.name = 'AudioConfigurationError';
    }

    static invalidConfig(field: string, value: any): AudioConfigurationError {
        return new AudioConfigurationError(
            `Invalid configuration for ${field}: ${value}`,
            { field, value }
        );
    }

    static missingConfig(field: string): AudioConfigurationError {
        return new AudioConfigurationError(
            `Missing required configuration: ${field}`,
            { field }
        );
    }

} 