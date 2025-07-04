/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

/**
 * Represents an audio recording device
 */
export interface AudioDevice {
    /** Device index as string identifier */
    index: string;
    /** Human-readable device name */
    name: string;
}

/**
 * Configuration for audio recording device
 */
export interface AudioDeviceConfig {
    /** Audio device index */
    audioDevice: string;
    /** Audio device name */
    audioDeviceName: string;
    /** Native sample rate of the selected device in Hz */
    sampleRate?: number;
    /** Number of audio channels (e.g. 1 = mono, 2 = stereo) */
    channels?: number;
    /** Human-readable channel layout reported by ffmpeg (e.g. "mono", "stereo") */
    channelLayout?: string;
}

/**
 * Options for audio processing and recording
 */
export interface AudioProcessingOptions {
    /** Input audio file path (if processing existing file) */
    file?: string;
    /** Audio device index to use for recording */
    audioDevice?: string;
    /** Maximum recording time in seconds */
    maxRecordingTime?: number;
    /** Output directory for saved files */
    outputDirectory?: string;
    /** Preferences directory for device configuration */
    preferencesDirectory?: string;
    /** Enable debug mode for additional logging */
    debug?: boolean;
    /** Dry run mode */
    dryRun?: boolean;
    /** Keep temporary raw recording directory for inspection */
    keepTemp?: boolean;
    /** Custom logger implementation */
    logger?: Logger;
}

/**
 * Result of audio processing operation
 */
export interface AudioProcessingResult {
    /** Path to the audio file */
    audioFilePath?: string;
    /** Whether the operation was cancelled */
    cancelled: boolean;
    /** Additional metadata about the processing */
    metadata?: AudioProcessingMetadata;
}

/**
 * Metadata from audio processing
 */
export interface AudioProcessingMetadata {
    /** Duration of audio in seconds */
    duration?: number;
    /** File size in bytes */
    fileSize?: number;
    /** Audio format detected */
    format?: string;
    /** Processing time in milliseconds */
    processingTime?: number;
}

/**
 * Interactive recording controls
 */
export interface AudioRecordingControls {
    /** Callback when recording is stopped manually */
    onStop?: () => void;
    /** Callback when recording is cancelled */
    onCancel?: () => void;
    /** Callback when recording is extended */
    onExtend?: (newDuration: number) => void;
    /** Callback for recording progress updates */
    onProgress?: (currentTime: number, maxTime: number) => void;
}

/**
 * Configuration options for the Unplayable library
 */
export interface UnplayableConfig {
    /** Default audio device configuration */
    defaultDevice?: AudioDeviceConfig;
    /** Default output directory for recordings */
    outputDirectory?: string;
    /** Default preferences directory */
    preferencesDirectory?: string;
    /** OpenAI API configuration for transcription */
    openai?: {
        apiKey?: string;
        model?: string;
        baseURL?: string;
    };
    /** Logging configuration */
    logging?: {
        level?: 'error' | 'warn' | 'info' | 'debug';
        silent?: boolean;
    };
    /** FFmpeg configuration */
    ffmpeg?: {
        path?: string;
        timeout?: number;
    };
}

/**
 * Logger interface for the library
 */
export interface Logger {
    error: (message: string, ...args: any[]) => void;
    warn: (message: string, ...args: any[]) => void;
    info: (message: string, ...args: any[]) => void;
    debug: (message: string, ...args: any[]) => void;
    verbose?: (message: string, ...args: any[]) => void;
}

/**
 * Supported audio file formats
 */
export const SUPPORTED_AUDIO_FORMATS = [
    'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'flac', 'aac', 'ogg', 'opus'
] as const;

export type SupportedAudioFormat = typeof SUPPORTED_AUDIO_FORMATS[number];

/**
 * Zod schemas for validation
 */
export const AudioDeviceSchema = z.object({
    index: z.string(),
    name: z.string(),
});

export const AudioDeviceConfigSchema = z.object({
    audioDevice: z.string(),
    audioDeviceName: z.string(),
    sampleRate: z.number().optional(),
    channels: z.number().optional(),
    channelLayout: z.string().optional(),
});

export const AudioProcessingOptionsSchema = z.object({
    file: z.string().optional(),
    audioDevice: z.string().optional(),
    maxRecordingTime: z.number().positive().optional(),
    outputDirectory: z.string().optional(),
    preferencesDirectory: z.string().optional(),
    debug: z.boolean().default(false),
    dryRun: z.boolean().default(false),
    keepTemp: z.boolean().default(false),
});

export const UnplayableConfigSchema = z.object({
    defaultDevice: AudioDeviceConfigSchema.optional(),
    outputDirectory: z.string().optional(),
    preferencesDirectory: z.string().optional(),
    openai: z.object({
        apiKey: z.string().optional(),
        model: z.string().default('whisper-1'),
        baseURL: z.string().optional(),
    }).optional(),
    logging: z.object({
        level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
        silent: z.boolean().default(false),
    }).optional(),
    ffmpeg: z.object({
        path: z.string().optional(),
        timeout: z.number().positive().default(30000),
    }).optional(),
});

/**
 * Library factory options
 */
export interface UnplayableFactoryOptions {
    /** Initial configuration for the library */
    config?: Partial<UnplayableConfig>;
    /** Custom logger instance */
    logger?: Logger;
} 