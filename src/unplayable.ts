import * as winston from 'winston';

import {
    UnplayableConfig,
    UnplayableFactoryOptions,
    AudioProcessingOptions,
    AudioProcessingResult,
    AudioDevice,
    AudioDeviceConfig,
    Logger
} from './types';
import { AudioProcessor, createAudioProcessor } from './processor';
import { ConfigurationManager, loadConfiguration } from './configuration';
import {
    detectBestAudioDevice,
    listAudioDevices,
    validateAudioDevice,
    getAudioDeviceInfo,
    saveAudioDeviceConfig,
    loadAudioDeviceConfig,
    selectAudioDeviceInteractively,
    selectAndConfigureAudioDevice
} from './devices';
import { validateAudioFile, hasSupportedAudioExtension } from './validation';

/**
 * Main Unplayable library class
 */
export class Unplayable {
    private readonly processor: AudioProcessor;
    private readonly config: ConfigurationManager;
    private readonly logger: Logger;

    constructor(processor: AudioProcessor, config: ConfigurationManager, logger: Logger) {
        this.processor = processor;
        this.config = config;
        this.logger = logger;
    }

    /**
     * Process audio from file or record new audio
     */
    async processAudio(options: Partial<AudioProcessingOptions> = {}): Promise<AudioProcessingResult> {
        const fullOptions: AudioProcessingOptions = {
            ...options,
            outputDirectory: options.outputDirectory || this.config.get('outputDirectory'),
            preferencesDirectory: options.preferencesDirectory || this.config.get('preferencesDirectory'),
            logger: options.logger || this.logger
        };

        return await this.processor.processAudio(fullOptions);
    }

    /**
     * Record audio only (without transcription)
     */
    async recordAudio(options: Partial<AudioProcessingOptions> = {}): Promise<string> {
        const result = await this.processAudio({
            ...options,
            // TODO: Add option to skip transcription
        });

        if (result.cancelled || !result.audioFilePath) {
            throw new Error('Recording was cancelled or failed');
        }

        return result.audioFilePath;
    }

    /**
     * Transcribe existing audio file
     */
    async transcribeFile(filePath: string, options: Partial<AudioProcessingOptions> = {}): Promise<string> {
        const result = await this.processAudio({
            ...options,
            file: filePath
        });

        return result.transcript;
    }

    /**
     * List available audio devices
     */
    async getAudioDevices(): Promise<AudioDevice[]> {
        return await listAudioDevices(this.logger);
    }

    /**
     * Detect the best audio device
     */
    async detectBestDevice(): Promise<string> {
        return await detectBestAudioDevice(this.logger);
    }

    /**
     * Validate if an audio device is accessible
     */
    async validateDevice(deviceIndex: string): Promise<boolean> {
        return await validateAudioDevice(deviceIndex, this.logger);
    }

    /**
     * Get detailed information about an audio device
     */
    async getDeviceInfo(deviceIndex: string): Promise<AudioDeviceConfig | null> {
        return await getAudioDeviceInfo(deviceIndex, this.logger);
    }

    /**
     * Save audio device configuration
     */
    async saveDeviceConfig(config: AudioDeviceConfig): Promise<void> {
        const preferencesDir = this.config.get('preferencesDirectory');
        if (!preferencesDir) {
            throw new Error('No preferences directory configured');
        }
        await saveAudioDeviceConfig(config, preferencesDir, this.logger);
    }

    /**
     * Load audio device configuration
     */
    async loadDeviceConfig(): Promise<AudioDeviceConfig | null> {
        const preferencesDir = this.config.get('preferencesDirectory');
        if (!preferencesDir) {
            return null;
        }
        return await loadAudioDeviceConfig(preferencesDir, this.logger);
    }

    /**
     * Interactively select an audio device
     */
    async selectAudioDevice(): Promise<AudioDevice | null> {
        return await selectAudioDeviceInteractively(this.logger);
    }

    /**
     * Select and configure an audio device (high-level method)
     */
    async selectAndConfigureDevice(debug: boolean = false): Promise<string> {
        const preferencesDir = this.config.get('preferencesDirectory');
        if (!preferencesDir) {
            throw new Error('No preferences directory configured');
        }
        return await selectAndConfigureAudioDevice(preferencesDir, this.logger, debug);
    }

    /**
     * Validate an audio file
     */
    async validateAudioFile(filePath: string): Promise<void> {
        await validateAudioFile(filePath, this.logger);
    }

    /**
     * Check if a file has a supported audio extension
     */
    isSupportedAudioFile(filePath: string): boolean {
        return hasSupportedAudioExtension(filePath);
    }

    /**
     * Get current configuration
     */
    getConfig(): UnplayableConfig {
        return this.config.getConfig();
    }

    /**
     * Update configuration
     */
    updateConfig(updates: Partial<UnplayableConfig>): void {
        this.config.updateConfig(updates);
    }

    /**
     * Save configuration to file
     */
    async saveConfig(configPath?: string): Promise<void> {
        if (configPath) {
            await this.config.saveToFile(configPath);
        } else {
            await this.config.saveToDefaultLocation();
        }
    }

    /**
     * Export configuration for debugging (with sensitive data masked)
     */
    exportConfig(): string {
        return this.config.exportConfig();
    }

    /**
     * Get the logger instance
     */
    getLogger(): Logger {
        return this.logger;
    }
}

/**
 * Create a default Winston logger
 */
const createDefaultLogger = (level: string = 'info', silent: boolean = false): Logger => {
    return winston.createLogger({
        level,
        silent,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple()
        ),
        transports: [
            new winston.transports.Console()
        ]
    });
};

/**
 * Factory function to create an Unplayable instance
 */
export const createUnplayable = async (options: UnplayableFactoryOptions = {}): Promise<Unplayable> => {
    // Create logger
    const logLevel = options.config?.logging?.level || 'info';
    const logSilent = options.config?.logging?.silent || false;
    const logger = options.logger || createDefaultLogger(logLevel, logSilent);

    // Load configuration
    const configManager = await loadConfiguration(options.config, logger);

    // Create processor with config access
    const processor = createAudioProcessor(logger, configManager);

    return new Unplayable(processor, configManager, logger);
};

/**
 * Convenience function to process audio with minimal setup
 */
export const processAudio = async (options: AudioProcessingOptions): Promise<AudioProcessingResult> => {
    const unplayable = await createUnplayable();
    return await unplayable.processAudio(options);
};

/**
 * Convenience function to record audio with minimal setup
 */
export const recordAudio = async (options: Partial<AudioProcessingOptions> = {}): Promise<string> => {
    const unplayable = await createUnplayable();
    return await unplayable.recordAudio(options);
};

/**
 * Convenience function to transcribe a file with minimal setup
 */
export const transcribeFile = async (filePath: string, options: Partial<AudioProcessingOptions> = {}): Promise<string> => {
    const unplayable = await createUnplayable();
    return await unplayable.transcribeFile(filePath, options);
};

/**
 * Convenience function to list audio devices
 */
export const getAudioDevices = async (): Promise<AudioDevice[]> => {
    const unplayable = await createUnplayable();
    return await unplayable.getAudioDevices();
};

// Re-export types and utilities for convenience
export * from './types';
export * from './error';
export {
    detectBestAudioDevice,
    listAudioDevices,
    validateAudioDevice,
    getAudioDeviceInfo,
    selectAudioDeviceInteractively,
    selectAndConfigureAudioDevice
} from './devices';
export { validateAudioFile, hasSupportedAudioExtension } from './validation';
export { createConfiguration, ConfigurationManager } from './configuration';
export { AudioProcessor, createAudioProcessor } from './processor';

// Default export for easier importing
export default {
    createUnplayable,
    processAudio,
    recordAudio,
    transcribeFile,
    getAudioDevices
}; 