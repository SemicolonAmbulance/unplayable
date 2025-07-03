/* eslint-disable @typescript-eslint/no-explicit-any */
import * as os from 'os';
import * as path from 'path';

import { UnplayableConfig, UnplayableConfigSchema, Logger } from './types';
import { AudioConfigurationError } from './error';
import { createStorage } from './util/storage';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: UnplayableConfig = {
    outputDirectory: path.join(os.homedir(), 'unplayable-recordings'),
    preferencesDirectory: path.join(os.homedir(), '.unplayable'),
    openai: {
        model: 'whisper-1'
    },
    logging: {
        level: 'info',
        silent: false
    },
    ffmpeg: {
        timeout: 30000
    }
};

/**
 * Configuration manager for the Unplayable library
 */
export class ConfigurationManager {
    private config: UnplayableConfig;
    private readonly storage = createStorage();
    private readonly logger?: Logger;

    constructor(initialConfig: Partial<UnplayableConfig> = {}, logger?: Logger) {
        this.logger = logger;
        this.config = this.mergeWithDefaults(initialConfig);
        this.validateConfig();
    }

    /**
     * Get the current configuration
     */
    getConfig(): UnplayableConfig {
        return { ...this.config };
    }

    /**
     * Update configuration with new values
     */
    updateConfig(updates: Partial<UnplayableConfig>): void {
        this.config = this.mergeWithDefaults({ ...this.config, ...updates });
        this.validateConfig();
        this.logger?.debug('Configuration updated');
    }

    /**
     * Reset configuration to defaults
     */
    resetToDefaults(): void {
        this.config = { ...DEFAULT_CONFIG };
        this.logger?.debug('Configuration reset to defaults');
    }

    /**
     * Load configuration from file
     */
    async loadFromFile(configPath: string): Promise<void> {
        try {
            const configData = await this.storage.readFile(configPath);
            const parsedConfig = JSON.parse(configData);

            this.config = this.mergeWithDefaults(parsedConfig);
            this.validateConfig();

            this.logger?.info(`Configuration loaded from: ${configPath}`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                this.logger?.debug(`Configuration file not found: ${configPath}`);
                return;
            }

            this.logger?.error(`Failed to load configuration from ${configPath}: ${error.message}`);
            throw AudioConfigurationError.invalidConfig('file', configPath);
        }
    }

    /**
     * Save configuration to file
     */
    async saveToFile(configPath: string): Promise<void> {
        try {
            const configData = JSON.stringify(this.config, null, 2);
            await this.storage.writeFile(configPath, configData);

            this.logger?.info(`Configuration saved to: ${configPath}`);
        } catch (error: any) {
            this.logger?.error(`Failed to save configuration to ${configPath}: ${error.message}`);
            throw AudioConfigurationError.invalidConfig('file', configPath);
        }
    }

    /**
     * Load configuration from default locations
     * Checks multiple locations in order of preference
     */
    async loadFromDefaultLocations(): Promise<void> {
        const defaultLocations = [
            path.join(process.cwd(), 'unplayable.config.json'),
            path.join(os.homedir(), '.unplayable', 'config.json'),
            path.join(os.homedir(), '.config', 'unplayable', 'config.json')
        ];

        for (const location of defaultLocations) {
            try {
                await this.loadFromFile(location);
                this.logger?.debug(`Configuration loaded from default location: ${location}`);
                return;
            } catch {
                // Continue to next location
            }
        }

        this.logger?.debug('No configuration file found in default locations, using defaults');
    }

    /**
     * Save configuration to default location
     */
    async saveToDefaultLocation(): Promise<void> {
        const defaultPath = path.join(os.homedir(), '.unplayable', 'config.json');
        await this.saveToFile(defaultPath);
    }

    /**
     * Get a specific configuration value with type safety
     */
    get<K extends keyof UnplayableConfig>(key: K): UnplayableConfig[K] {
        return this.config[key];
    }

    /**
     * Set a specific configuration value with validation
     */
    set<K extends keyof UnplayableConfig>(key: K, value: UnplayableConfig[K]): void {
        const newConfig = { ...this.config, [key]: value };
        this.config = this.mergeWithDefaults(newConfig);
        this.validateConfig();
        this.logger?.debug(`Configuration value set: ${key}`);
    }

    /**
     * Validate the current configuration
     */
    private validateConfig(): void {
        try {
            UnplayableConfigSchema.parse(this.config);
        } catch (error: any) {
            this.logger?.error('Configuration validation failed:', error);
            throw AudioConfigurationError.invalidConfig('validation', error.message);
        }
    }

    /**
     * Merge configuration with defaults
     */
    private mergeWithDefaults(config: Partial<UnplayableConfig>): UnplayableConfig {
        return {
            ...DEFAULT_CONFIG,
            ...config,
            openai: {
                ...DEFAULT_CONFIG.openai,
                ...config.openai
            },
            logging: {
                ...DEFAULT_CONFIG.logging,
                ...config.logging
            },
            ffmpeg: {
                ...DEFAULT_CONFIG.ffmpeg,
                ...config.ffmpeg
            }
        };
    }

    /**
     * Ensure required directories exist
     */
    async ensureDirectories(): Promise<void> {
        const directories = [
            this.config.outputDirectory,
            this.config.preferencesDirectory
        ].filter(Boolean) as string[];

        for (const dir of directories) {
            try {
                await this.storage.ensureDirectory(dir);
                this.logger?.debug(`Ensured directory exists: ${dir}`);
            } catch (error: any) {
                this.logger?.error(`Failed to create directory ${dir}: ${error.message}`);
                throw AudioConfigurationError.invalidConfig('directory', dir);
            }
        }
    }

    /**
     * Validate OpenAI configuration
     */
    validateOpenAIConfig(): boolean {
        if (!this.config.openai?.apiKey) {
            return false;
        }

        const apiKey = this.config.openai.apiKey;
        if (typeof apiKey !== 'string' || apiKey.length < 10) {
            return false;
        }

        if (!apiKey.startsWith('sk-')) {
            this.logger?.warn('OpenAI API key does not start with "sk-", this may be incorrect');
        }

        return true;
    }

    /**
     * Get environment-based configuration
     * Loads configuration from environment variables
     */
    loadFromEnvironment(): void {
        const envConfig: Partial<UnplayableConfig> = {};

        // OpenAI configuration
        if (process.env.OPENAI_API_KEY) {
            envConfig.openai = {
                ...this.config.openai,
                apiKey: process.env.OPENAI_API_KEY
            };
        }

        if (process.env.OPENAI_MODEL) {
            envConfig.openai = {
                ...envConfig.openai,
                model: process.env.OPENAI_MODEL
            };
        }

        if (process.env.OPENAI_BASE_URL) {
            envConfig.openai = {
                ...envConfig.openai,
                baseURL: process.env.OPENAI_BASE_URL
            };
        }

        // Directory configuration
        if (process.env.UNPLAYABLE_OUTPUT_DIR) {
            envConfig.outputDirectory = process.env.UNPLAYABLE_OUTPUT_DIR;
        }

        if (process.env.UNPLAYABLE_PREFS_DIR) {
            envConfig.preferencesDirectory = process.env.UNPLAYABLE_PREFS_DIR;
        }

        // Logging configuration
        if (process.env.UNPLAYABLE_LOG_LEVEL) {
            envConfig.logging = {
                ...this.config.logging,
                level: process.env.UNPLAYABLE_LOG_LEVEL as any
            };
        }

        if (process.env.UNPLAYABLE_SILENT) {
            envConfig.logging = {
                ...envConfig.logging,
                silent: process.env.UNPLAYABLE_SILENT === 'true'
            };
        }

        // FFmpeg configuration
        if (process.env.FFMPEG_PATH) {
            envConfig.ffmpeg = {
                ...this.config.ffmpeg,
                path: process.env.FFMPEG_PATH
            };
        }

        if (process.env.FFMPEG_TIMEOUT) {
            const timeout = parseInt(process.env.FFMPEG_TIMEOUT, 10);
            if (!isNaN(timeout)) {
                envConfig.ffmpeg = {
                    ...envConfig.ffmpeg,
                    timeout
                };
            }
        }

        if (Object.keys(envConfig).length > 0) {
            this.updateConfig(envConfig);
            this.logger?.debug('Configuration loaded from environment variables');
        }
    }

    /**
     * Export configuration for debugging
     */
    exportConfig(): string {
        const exportConfig = { ...this.config };
        if (exportConfig.openai?.apiKey) {
            exportConfig.openai.apiKey = exportConfig.openai.apiKey.slice(0, 8) + '...';
        }
        return JSON.stringify(exportConfig, null, 2);
    }
}

/**
 * Create a configuration manager with initial config
 */
export const createConfiguration = (
    initialConfig: Partial<UnplayableConfig> = {},
    logger?: Logger
): ConfigurationManager => {
    return new ConfigurationManager(initialConfig, logger);
};

/**
 * Load configuration from various sources in order of precedence:
 * 1. Provided initial config
 * 2. Environment variables  
 * 3. Configuration files
 * 4. Defaults
 * 
 * @param initialConfig Initial configuration
 * @param logger Optional logger
 * @returns Promise resolving to ConfigurationManager
 */
export const loadConfiguration = async (
    initialConfig: Partial<UnplayableConfig> = {},
    logger?: Logger
): Promise<ConfigurationManager> => {
    const configManager = createConfiguration(initialConfig, logger);

    // Load from environment variables
    configManager.loadFromEnvironment();

    // Load from default file locations
    await configManager.loadFromDefaultLocations();

    // Ensure required directories exist
    await configManager.ensureDirectories();

    return configManager;
}; 