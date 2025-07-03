/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs/promises';
import * as path from 'path';

import { SUPPORTED_AUDIO_FORMATS, Logger } from './types';
import { AudioProcessingError } from './error';

/**
 * Validates an audio file for processing
 * @param filePath Path to the audio file to validate
 * @param logger Optional logger for debugging
 * @throws AudioProcessingError if validation fails
 */
export const validateAudioFile = async (filePath: string, logger?: Logger): Promise<void> => {
    try {
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw AudioProcessingError.fileNotFound(filePath);
            }
            throw error;
        }

        // Check file extension
        const ext = path.extname(filePath).toLowerCase().slice(1); // Remove the dot
        if (!SUPPORTED_AUDIO_FORMATS.includes(ext as any)) {
            throw AudioProcessingError.unsupportedFormat(ext);
        }

        // Check if file is not empty
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
            throw AudioProcessingError.emptyFile(filePath);
        }

        // Check minimum file size (should be at least a few hundred bytes for a valid audio file)
        const minFileSize = 100; // bytes
        if (stats.size < minFileSize) {
            throw AudioProcessingError.emptyFile(filePath);
        }

        logger?.debug(`Audio file validation passed: ${filePath} (${stats.size} bytes)`);
    } catch (error: any) {
        logger?.error(`Audio file validation failed for ${filePath}: ${error.message}`);
        throw error;
    }
};

/**
 * Validates an audio file and returns metadata
 * @param filePath Path to the audio file to validate
 * @param logger Optional logger for debugging
 * @returns Promise resolving to file metadata
 */
export const validateAndGetAudioFileInfo = async (filePath: string, logger?: Logger) => {
    await validateAudioFile(filePath, logger);

    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);

    return {
        filePath,
        size: stats.size,
        format: ext,
        lastModified: stats.mtime,
        created: stats.birthtime
    };
};

/**
 * Checks if a file path has a supported audio extension
 * @param filePath Path to check
 * @returns True if the file has a supported audio extension
 */
export const hasSupportedAudioExtension = (filePath: string): boolean => {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    return SUPPORTED_AUDIO_FORMATS.includes(ext as any);
};

/**
 * Validates multiple audio files
 * @param filePaths Array of file paths to validate
 * @param logger Optional logger for debugging
 * @returns Promise resolving to validation results
 */
export const validateAudioFiles = async (filePaths: string[], logger?: Logger) => {
    const results = [];

    for (const filePath of filePaths) {
        try {
            await validateAudioFile(filePath, logger);
            results.push({ filePath, valid: true, error: null });
        } catch (error: any) {
            results.push({ filePath, valid: false, error: error.message });
        }
    }

    return results;
};

/**
 * Validates audio processing options
 * @param options Options to validate
 * @param logger Optional logger for debugging
 * @throws AudioProcessingError if validation fails
 */
export const validateAudioProcessingOptions = async (options: any, logger?: Logger): Promise<void> => {
    // If file is provided, validate it
    if (options.file) {
        await validateAudioFile(options.file, logger);
    }

    // Validate numeric options
    if (options.maxRecordingTime !== undefined) {
        if (typeof options.maxRecordingTime !== 'number' || options.maxRecordingTime <= 0) {
            throw new AudioProcessingError('maxRecordingTime must be a positive number');
        }

        // Reasonable limits
        if (options.maxRecordingTime > 3600) { // 1 hour
            logger?.warn('maxRecordingTime is very long (>1 hour), this may consume significant resources');
        }
    }

    // Validate directories
    if (options.outputDirectory) {
        try {
            const stats = await fs.stat(options.outputDirectory);
            if (!stats.isDirectory()) {
                throw new AudioProcessingError(`outputDirectory is not a directory: ${options.outputDirectory}`);
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // Directory doesn't exist, but that's okay - we can create it
                logger?.debug(`Output directory doesn't exist, will create: ${options.outputDirectory}`);
            } else {
                throw new AudioProcessingError(`Cannot access outputDirectory: ${error.message}`);
            }
        }
    }

    if (options.preferencesDirectory) {
        try {
            const stats = await fs.stat(options.preferencesDirectory);
            if (!stats.isDirectory()) {
                throw new AudioProcessingError(`preferencesDirectory is not a directory: ${options.preferencesDirectory}`);
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // Directory doesn't exist, but that's okay - we can create it
                logger?.debug(`Preferences directory doesn't exist, will create: ${options.preferencesDirectory}`);
            } else {
                throw new AudioProcessingError(`Cannot access preferencesDirectory: ${error.message}`);
            }
        }
    }

    logger?.debug('Audio processing options validation passed');
};

/**
 * Estimates audio file duration based on file size (rough approximation)
 * @param filePath Path to the audio file
 * @param logger Optional logger for debugging
 * @returns Promise resolving to estimated duration in seconds
 */
export const estimateAudioDuration = async (filePath: string, logger?: Logger): Promise<number> => {
    try {
        await validateAudioFile(filePath, logger);

        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase().slice(1);

        // Rough estimates based on common bitrates
        // These are very approximate and should not be relied upon for precise timing
        let bytesPerSecond: number;

        switch (ext) {
            case 'mp3':
                bytesPerSecond = 16000; // ~128kbps
                break;
            case 'wav':
                bytesPerSecond = 176400; // 44.1kHz, 16-bit, stereo
                break;
            case 'flac':
                bytesPerSecond = 88200; // roughly half of WAV
                break;
            case 'aac':
            case 'm4a':
                bytesPerSecond = 12000; // ~96kbps
                break;
            default:
                bytesPerSecond = 16000; // default estimate
        }

        const estimatedDuration = stats.size / bytesPerSecond;
        logger?.debug(`Estimated duration for ${filePath}: ${estimatedDuration.toFixed(1)}s`);

        return estimatedDuration;
    } catch (error) {
        logger?.error(`Failed to estimate duration for ${filePath}: ${error}`);
        return 0;
    }
}; 