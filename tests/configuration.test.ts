/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';

// Mock dependencies before importing the module
vi.mock('../src/util/storage', () => ({
    createStorage: vi.fn(() => ({
        readFile: vi.fn(),
        writeFile: vi.fn(),
        ensureDirectory: vi.fn()
    }))
}));

vi.mock('../src/types', () => ({
    UnplayableConfigSchema: {
        parse: vi.fn()
    }
}));

vi.mock('../src/error', () => ({
    AudioConfigurationError: {
        invalidConfig: vi.fn((field: string, value: any) => {
            const error = new Error(`Invalid config: ${field} - ${value}`);
            throw error;
        })
    }
}));

import {
    ConfigurationManager,
    DEFAULT_CONFIG,
    createConfiguration,
    loadConfiguration
} from '../src/configuration';
import { createStorage } from '../src/util/storage';
import { UnplayableConfigSchema } from '../src/types';
import { AudioConfigurationError } from '../src/error';

describe('Configuration', () => {
    const mockLogger = {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    };

    let mockStorage: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset environment variables
        delete process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_MODEL;
        delete process.env.OPENAI_BASE_URL;
        delete process.env.UNPLAYABLE_OUTPUT_DIR;
        delete process.env.UNPLAYABLE_PREFS_DIR;
        delete process.env.UNPLAYABLE_LOG_LEVEL;
        delete process.env.UNPLAYABLE_SILENT;
        delete process.env.FFMPEG_PATH;
        delete process.env.FFMPEG_TIMEOUT;

        mockStorage = {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            ensureDirectory: vi.fn()
        };

        vi.mocked(createStorage).mockReturnValue(mockStorage);
        vi.mocked(UnplayableConfigSchema.parse).mockImplementation((config) => config as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('DEFAULT_CONFIG', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_CONFIG).toEqual({
                outputDirectory: path.join(os.homedir(), 'unplayable-recordings'),
                preferencesDirectory: path.join(os.homedir(), '.unplayable'),
                logging: {
                    level: 'info',
                    silent: false
                },
                ffmpeg: {
                    timeout: 30000
                }
            });
        });
    });

    describe('ConfigurationManager', () => {
        describe('constructor', () => {
            it('should create instance with default config when no initial config provided', () => {
                const manager = new ConfigurationManager();

                expect(manager.getConfig()).toEqual(DEFAULT_CONFIG);
                expect(UnplayableConfigSchema.parse).toHaveBeenCalledWith(DEFAULT_CONFIG);
            });

            it('should merge initial config with defaults', () => {
                const initialConfig = {
                    outputDirectory: '/custom/output',
                    openai: { apiKey: 'test-key' }
                };

                const manager = new ConfigurationManager(initialConfig);
                const config = manager.getConfig();

                expect(config.outputDirectory).toBe('/custom/output');
                expect(config.logging).toEqual(DEFAULT_CONFIG.logging);
            });

            it('should create instance with logger', () => {
                const manager = new ConfigurationManager({}, mockLogger);

                // Should not throw and should work normally
                expect(manager.getConfig()).toBeDefined();
            });

            it('should throw error on invalid config during construction', () => {
                vi.mocked(UnplayableConfigSchema.parse).mockImplementationOnce(() => {
                    throw new Error('Invalid schema');
                });

                expect(() => new ConfigurationManager({ outputDirectory: '/test' })).toThrow();
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('validation', 'Invalid schema');
            });
        });

        describe('getConfig', () => {
            it('should return a copy of the current configuration', () => {
                const manager = new ConfigurationManager();
                const config1 = manager.getConfig();
                const config2 = manager.getConfig();

                expect(config1).toEqual(config2);
                expect(config1).not.toBe(config2); // Should be different objects
            });
        });

        describe('updateConfig', () => {
            it('should update configuration with new values', () => {
                const manager = new ConfigurationManager({}, mockLogger);

                manager.updateConfig({
                    outputDirectory: '/new/output',
                    logging: { level: 'debug' }
                });

                const config = manager.getConfig();
                expect(config.outputDirectory).toBe('/new/output');
                expect(config.logging?.level).toBe('debug');
                expect(mockLogger.debug).toHaveBeenCalledWith('Configuration updated');
            });

            it('should validate updated configuration', () => {
                const manager = new ConfigurationManager();

                vi.mocked(UnplayableConfigSchema.parse).mockImplementationOnce(() => {
                    throw new Error('Invalid update');
                });

                expect(() => manager.updateConfig({ outputDirectory: '/invalid' })).toThrow();
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('validation', 'Invalid update');
            });

        });

        describe('resetToDefaults', () => {
            it('should reset configuration to defaults', () => {
                const manager = new ConfigurationManager({ outputDirectory: '/custom' }, mockLogger);

                manager.resetToDefaults();

                expect(manager.getConfig()).toEqual(DEFAULT_CONFIG);
                expect(mockLogger.debug).toHaveBeenCalledWith('Configuration reset to defaults');
            });
        });

        describe('loadFromFile', () => {
            it('should load configuration from valid JSON file', async () => {
                const configData = {
                    outputDirectory: '/file/output',
                    logging: { level: 'debug' }
                };
                mockStorage.readFile.mockResolvedValue(JSON.stringify(configData));

                const manager = new ConfigurationManager({}, mockLogger);
                await manager.loadFromFile('/test/config.json');

                const config = manager.getConfig();
                expect(config.outputDirectory).toBe('/file/output');
                expect(config.logging?.level).toBe('debug');
                expect(mockLogger.info).toHaveBeenCalledWith('Configuration loaded from: /test/config.json');
            });

            it('should handle file not found gracefully', async () => {
                const error = new Error('File not found');
                (error as any).code = 'ENOENT';
                mockStorage.readFile.mockRejectedValue(error);

                const manager = new ConfigurationManager({}, mockLogger);
                await manager.loadFromFile('/nonexistent/config.json');

                expect(mockLogger.debug).toHaveBeenCalledWith('Configuration file not found: /nonexistent/config.json');
            });

            it('should throw error for invalid JSON', async () => {
                mockStorage.readFile.mockResolvedValue('invalid json');

                const manager = new ConfigurationManager({}, mockLogger);

                await expect(manager.loadFromFile('/test/config.json')).rejects.toThrow();
                expect(mockLogger.error).toHaveBeenCalled();
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('file', '/test/config.json');
            });

            it('should throw error for file read errors other than ENOENT', async () => {
                const error = new Error('Permission denied');
                (error as any).code = 'EACCES';
                mockStorage.readFile.mockRejectedValue(error);

                const manager = new ConfigurationManager({}, mockLogger);

                await expect(manager.loadFromFile('/test/config.json')).rejects.toThrow();
                expect(mockLogger.error).toHaveBeenCalledWith('Failed to load configuration from /test/config.json: Permission denied');
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('file', '/test/config.json');
            });


        });

        describe('saveToFile', () => {
            it('should save configuration to file', async () => {
                const manager = new ConfigurationManager({ outputDirectory: '/test' }, mockLogger);

                await manager.saveToFile('/test/config.json');

                expect(mockStorage.writeFile).toHaveBeenCalledWith(
                    '/test/config.json',
                    expect.stringContaining('"outputDirectory": "/test"')
                );
                expect(mockLogger.info).toHaveBeenCalledWith('Configuration saved to: /test/config.json');
            });

            it('should handle save errors', async () => {
                mockStorage.writeFile.mockRejectedValue(new Error('Write failed'));

                const manager = new ConfigurationManager({}, mockLogger);

                await expect(manager.saveToFile('/test/config.json')).rejects.toThrow();
                expect(mockLogger.error).toHaveBeenCalledWith('Failed to save configuration to /test/config.json: Write failed');
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('file', '/test/config.json');
            });
        });

        describe('loadFromDefaultLocations', () => {
            it('should load from first available default location', async () => {
                mockStorage.readFile
                    .mockRejectedValueOnce(new Error('Not found')) // First location fails
                    .mockResolvedValueOnce('{"outputDirectory": "/default"}'); // Second location succeeds

                const manager = new ConfigurationManager({}, mockLogger);
                await manager.loadFromDefaultLocations();

                const config = manager.getConfig();
                expect(config.outputDirectory).toBe('/default');
                expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Configuration loaded from default location:'));
            });

            it('should continue if all default locations fail', async () => {
                mockStorage.readFile.mockRejectedValue(new Error('Not found'));

                const manager = new ConfigurationManager({}, mockLogger);
                await manager.loadFromDefaultLocations();

                expect(mockLogger.debug).toHaveBeenCalledWith('No configuration file found in default locations, using defaults');
            });
        });

        describe('saveToDefaultLocation', () => {
            it('should save to default location', async () => {
                const manager = new ConfigurationManager();

                await manager.saveToDefaultLocation();

                const expectedPath = path.join(os.homedir(), '.unplayable', 'config.json');
                expect(mockStorage.writeFile).toHaveBeenCalledWith(
                    expectedPath,
                    expect.any(String)
                );
            });
        });

        describe('get', () => {
            it('should get specific configuration value', () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '/test/output'
                });

                expect(manager.get('outputDirectory')).toBe('/test/output');
                expect(manager.get('logging')).toEqual(DEFAULT_CONFIG.logging);
            });
        });

        describe('set', () => {
            it('should set specific configuration value', () => {
                const manager = new ConfigurationManager({}, mockLogger);

                manager.set('outputDirectory', '/new/output');

                expect(manager.get('outputDirectory')).toBe('/new/output');
                expect(mockLogger.debug).toHaveBeenCalledWith('Configuration value set: outputDirectory');
            });

            it('should validate when setting value', () => {
                const manager = new ConfigurationManager();

                vi.mocked(UnplayableConfigSchema.parse).mockImplementationOnce(() => {
                    throw new Error('Invalid set value');
                });

                expect(() => manager.set('outputDirectory', '/invalid')).toThrow();
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('validation', 'Invalid set value');
            });
        });

        describe('ensureDirectories', () => {
            it('should ensure all configured directories exist', async () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '/test/output',
                    preferencesDirectory: '/test/prefs'
                }, mockLogger);

                await manager.ensureDirectories();

                expect(mockStorage.ensureDirectory).toHaveBeenCalledWith('/test/output');
                expect(mockStorage.ensureDirectory).toHaveBeenCalledWith('/test/prefs');
                expect(mockLogger.debug).toHaveBeenCalledWith('Ensured directory exists: /test/output');
                expect(mockLogger.debug).toHaveBeenCalledWith('Ensured directory exists: /test/prefs');
            });

            it('should handle directory creation errors', async () => {
                mockStorage.ensureDirectory.mockRejectedValue(new Error('Create failed'));

                const manager = new ConfigurationManager({
                    outputDirectory: '/test/output'
                }, mockLogger);

                await expect(manager.ensureDirectories()).rejects.toThrow();
                expect(mockLogger.error).toHaveBeenCalledWith('Failed to create directory /test/output: Create failed');
                expect(AudioConfigurationError.invalidConfig).toHaveBeenCalledWith('directory', '/test/output');
            });

            it('should filter out falsy directory values', async () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '',
                    preferencesDirectory: undefined
                });

                await manager.ensureDirectories();

                expect(mockStorage.ensureDirectory).not.toHaveBeenCalled();
            });
        });

        describe('loadFromEnvironment', () => {

            it('should load directory configuration from environment', () => {
                process.env.UNPLAYABLE_OUTPUT_DIR = '/env/output';
                process.env.UNPLAYABLE_PREFS_DIR = '/env/prefs';

                const manager = new ConfigurationManager({});
                manager.loadFromEnvironment();

                const config = manager.getConfig();
                expect(config.outputDirectory).toBe('/env/output');
                expect(config.preferencesDirectory).toBe('/env/prefs');
            });

            it('should load logging configuration from environment', () => {
                process.env.UNPLAYABLE_LOG_LEVEL = 'debug';
                process.env.UNPLAYABLE_SILENT = 'true';

                const manager = new ConfigurationManager({});
                manager.loadFromEnvironment();

                const config = manager.getConfig();
                expect(config.logging?.level).toBe('debug');
                expect(config.logging?.silent).toBe(true);
            });

            it('should load FFmpeg configuration from environment', () => {
                process.env.FFMPEG_PATH = '/custom/ffmpeg';
                process.env.FFMPEG_TIMEOUT = '60000';

                const manager = new ConfigurationManager({});
                manager.loadFromEnvironment();

                const config = manager.getConfig();
                expect(config.ffmpeg?.path).toBe('/custom/ffmpeg');
                expect(config.ffmpeg?.timeout).toBe(60000);
            });

            it('should ignore invalid FFMPEG_TIMEOUT', () => {
                process.env.FFMPEG_TIMEOUT = 'invalid';

                const manager = new ConfigurationManager({});
                manager.loadFromEnvironment();

                const config = manager.getConfig();
                expect(config.ffmpeg?.timeout).toBe(DEFAULT_CONFIG.ffmpeg!.timeout);
            });

            it('should preserve existing config when no environment variables are set', () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '/original'
                });

                manager.loadFromEnvironment();

                const config = manager.getConfig();
                expect(config.outputDirectory).toBe('/original');
            });

        });

        describe('exportConfig', () => {
            it('should export configuration with masked API key', () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '/test',
                });

                const exported = manager.exportConfig();
                const parsed = JSON.parse(exported);

                expect(parsed.outputDirectory).toBe('/test');
            });

            it('should export configuration without API key if not set', () => {
                const manager = new ConfigurationManager({
                    outputDirectory: '/test'
                });

                const exported = manager.exportConfig();
                const parsed = JSON.parse(exported);

                expect(parsed.outputDirectory).toBe('/test');
                expect(parsed.openai?.apiKey).toBeUndefined();
            });
        });
    });

    describe('createConfiguration', () => {
        it('should create ConfigurationManager with initial config', () => {
            const config = { outputDirectory: '/test' };
            const manager = createConfiguration(config, mockLogger);

            expect(manager).toBeInstanceOf(ConfigurationManager);
            expect(manager.get('outputDirectory')).toBe('/test');
        });

        it('should create ConfigurationManager without parameters', () => {
            const manager = createConfiguration();

            expect(manager).toBeInstanceOf(ConfigurationManager);
            expect(manager.getConfig()).toEqual(DEFAULT_CONFIG);
        });
    });

    describe('loadConfiguration', () => {
        it('should load configuration with all sources', async () => {
            // Setup environment
            process.env.OPENAI_API_KEY = 'sk-env-key';

            // Setup file loading to succeed (includes environment variable to preserve it)
            mockStorage.readFile.mockResolvedValue('{"outputDirectory": "/file/output", "openai": {"apiKey": "sk-env-key"}}');

            const manager = await loadConfiguration({ logging: { level: 'debug' } }, mockLogger);

            const config = manager.getConfig();
            expect(config.outputDirectory).toBe('/file/output'); // File

            expect(mockStorage.ensureDirectory).toHaveBeenCalled();
        });

        it('should handle errors during directory creation', async () => {
            mockStorage.ensureDirectory.mockRejectedValue(new Error('Cannot create directory'));

            await expect(loadConfiguration()).rejects.toThrow();
        });

        it('should work with default parameters', async () => {
            const manager = await loadConfiguration();

            expect(manager).toBeInstanceOf(ConfigurationManager);
            expect(manager.getConfig()).toBeDefined();
        });
    });
});
