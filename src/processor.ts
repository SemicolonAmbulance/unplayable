/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

import {
    AudioProcessingOptions,
    AudioProcessingResult,
    AudioProcessingMetadata,
    AudioRecordingControls,
    AudioDeviceConfig,
    Logger
} from './types';
import {
    AudioConfigurationError,
    AudioRecordingError
} from './error';
import {
    detectBestAudioDevice,
    loadAudioDeviceConfig,
    audioDeviceConfigExists,
    validateAudioDevice
} from './devices';
import { validateAudioFile, validateAudioProcessingOptions } from './validation';
import { createStorage, generateTimestampedFilename, generateUniqueFilename } from './util/storage';
import { run } from './util/child';
import { ConfigurationManager } from './configuration';

/**
 * Main audio processor class that handles recording, processing
 */
export class AudioProcessor {
    private readonly logger?: Logger;
    private readonly storage = createStorage();
    private readonly config?: ConfigurationManager;

    constructor(logger?: Logger, config?: ConfigurationManager) {
        this.logger = logger;
        this.config = config;
    }

    /**
     * Process audio from either a file or by recording new audio
     */
    async processAudio(options: AudioProcessingOptions): Promise<AudioProcessingResult> {
        const startTime = Date.now();

        try {
            // Validate options
            await validateAudioProcessingOptions(options, this.logger);

            // Handle dry run mode early, before any device checks
            if (options.dryRun) {
                return this.handleDryRun(options);
            }

            // Check if audio device is configured (only for recording, not for file processing)
            if (!options.file && options.preferencesDirectory &&
                !await audioDeviceConfigExists(options.preferencesDirectory)) {
                throw new AudioConfigurationError(
                    'No audio device configured. Please configure your audio device first.'
                );
            }

            const result = options.file
                ? await this.processAudioFile(options.file, options)
                : await this.record(options);

            // Add processing metadata
            result.metadata = {
                ...result.metadata,
                processingTime: Date.now() - startTime
            };

            return result;
        } catch (error: any) {
            this.logger?.error(`Audio processing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process an existing audio file
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async processAudioFile(filePath: string, options: AudioProcessingOptions): Promise<AudioProcessingResult> {
        this.logger?.info(`🎯 Processing audio file: ${filePath}`);

        // Validate the audio file
        await validateAudioFile(filePath, this.logger);

        // Get file metadata
        const stats = await this.storage.getFileStats(filePath);
        const metadata: AudioProcessingMetadata = {
            fileSize: stats.size,
            format: path.extname(filePath).slice(1).toLowerCase()
        };

        return {
            audioFilePath: filePath,
            cancelled: false,
            metadata
        };
    }

    /**
     * Record  new audio
     */
    private async record(options: AudioProcessingOptions): Promise<AudioProcessingResult> {
        this.logger?.info('🎙️ Starting audio recording...');

        // Get audio device configuration
        const audioDevice = await this.getAudioDeviceConfig(options);

        // Create temporary recording directory
        const tempDir = await this.createTempRecordingDir();
        const audioFileName = generateTimestampedFilename('recording', 'wav');
        const tempAudioPath = path.join(tempDir, audioFileName);

        try {
            // Record audio
            const recordingResult = await this.recordAudio({
                audioDevice,
                outputPath: tempAudioPath,
                maxTime: options.maxRecordingTime || 60,
                controls: {} // TODO: Implement interactive controls
            });

            if (recordingResult.cancelled) {
                return {
                    cancelled: true
                };
            }

            // Validate recorded file
            await validateAudioFile(tempAudioPath, this.logger);

            // Get recording metadata
            const stats = await this.storage.getFileStats(tempAudioPath);
            const metadata: AudioProcessingMetadata = {
                fileSize: stats.size,
                format: 'wav'
            };


            let finalAudioPath: string | undefined;

            // Save files to output directory if specified
            if (options.outputDirectory) {
                await this.storage.ensureDirectory(options.outputDirectory);

                // Save audio file
                const finalAudioFileName = generateTimestampedFilename('recording', 'wav');
                finalAudioPath = await generateUniqueFilename(
                    path.join(options.outputDirectory, finalAudioFileName),
                    this.storage
                );
                await this.storage.copyFile(tempAudioPath, finalAudioPath);
            }

            // Cleanup temp directory unless keepTemp is specified
            if (!options.keepTemp) {
                await this.cleanupTempDir(tempDir);
            } else {
                this.logger?.info(`Temporary recording kept at: ${tempDir}`);
            }

            this.logger?.info('✅ Recording completed successfully');
            return {
                audioFilePath: finalAudioPath,
                cancelled: false,
                metadata
            };

        } catch (error: any) {
            // Cleanup on error
            await this.cleanupTempDir(tempDir);
            throw error;
        }
    }

    /**
     * Record audio using ffmpeg
     */
    private async recordAudio(params: {
        audioDevice: AudioDeviceConfig;
        outputPath: string;
        maxTime: number;
        controls: AudioRecordingControls;
    }): Promise<{ cancelled: boolean }> {
        const { audioDevice, outputPath, maxTime } = params;

        this.logger?.info(`🔴 Recording from device: [${audioDevice.audioDevice}] ${audioDevice.audioDeviceName}`);
        this.logger?.info(`⏱️ Maximum recording time: ${maxTime} seconds`);

        // Check if we need to enable key handling
        const enableKeyHandling = this.shouldEnableKeyHandling();

        if (enableKeyHandling) {
            this.logger?.info('⏹️ Press ENTER to stop recording or C to cancel');
        } else {
            this.logger?.info('⏹️ Press Ctrl+C to stop recording early');
        }

        try {
            const ffmpegArgs = [
                '-f', 'avfoundation',
                '-i', `:${audioDevice.audioDevice}`,
                '-t', maxTime.toString(),
                '-acodec', 'pcm_s16le',
                '-ar', '44100',
                '-ac', '1',
                '-y', // Overwrite output file
                outputPath
            ];

            // Use configured ffmpeg path or default to 'ffmpeg'
            const ffmpegPath = this.config?.get('ffmpeg')?.path || 'ffmpeg';

            if (enableKeyHandling) {
                return await this.recordWithKeyHandling(ffmpegPath, ffmpegArgs, maxTime);
            } else {
                const result = await run(ffmpegPath, ffmpegArgs, {
                    timeout: (maxTime + 10) * 1000, // Add 10 seconds buffer to the timeout
                    logger: this.logger,
                    captureStderr: true
                });

                if (result.code !== 0) {
                    this.logger?.error(`FFmpeg exited with code ${result.code}: ${result.stderr}`);
                    throw new AudioRecordingError(`FFmpeg exited with code ${result.code}: ${result.stderr}`);
                }

                this.logger?.info(`✅ Recording completed: ${outputPath}`);
                return { cancelled: false };
            }

        } catch (error: any) {
            this.logger?.error(`Recording failed: ${error.message || 'undefined'}`);
            throw new AudioRecordingError(`Audio recording failed: ${error.message || 'undefined'}`);
        }
    }

    /**
     * Record audio with custom key handling
     */
    private async recordWithKeyHandling(ffmpegPath: string, ffmpegArgs: string[], maxTime: number): Promise<{ cancelled: boolean }> {

        return new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stderr = '';
            let isFinished = false;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            // Set up timeout
            if (maxTime > 0) {
                timeoutId = setTimeout(() => {
                    if (!isFinished) {
                        this.logger?.debug(`Recording reached maximum time of ${maxTime}s, stopping...`);
                        child.kill('SIGTERM');
                        setTimeout(() => {
                            if (!child.killed) {
                                child.kill('SIGKILL');
                            }
                        }, 5000);
                    }
                }, maxTime * 1000);
            }

            // Handle stdout
            child.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                this.logger?.debug(`ffmpeg stdout: ${text.trim()}`);
            });

            // Handle stderr
            child.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                stderr += text;
                this.logger?.debug(`ffmpeg stderr: ${text.trim()}`);
            });

            // Set up keyboard input handling
            // Enable raw mode to capture individual key presses
            if (process.stdin.setRawMode) {
                process.stdin.setRawMode(true);
            }

            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const keyHandler = (key: string) => {
                if (isFinished) return;

                if (key === '\r' || key === '\n') {
                    // ENTER key pressed - stop recording
                    this.logger?.info('⏹️ ENTER pressed - stopping recording...');
                    isFinished = true;
                    child.kill('SIGTERM');

                    // Set a timeout to ensure we resolve even if the process doesn't exit cleanly
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                        // Force resolution if the process still hasn't exited
                        cleanup();
                        this.logger?.info('✅ Recording stopped successfully');
                        resolve({ cancelled: false });
                    }, 1000);
                } else if (key.toLowerCase() === 'c') {
                    // C key pressed - cancel recording
                    this.logger?.info('❌ C pressed - cancelling recording...');
                    isFinished = true;
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 1000);

                    // Clean up and return cancelled
                    cleanup();
                    resolve({ cancelled: true });
                    return;
                } else if (key === '\u0003') {
                    // Ctrl+C pressed - also cancel
                    this.logger?.info('❌ Ctrl+C pressed - cancelling recording...');
                    isFinished = true;
                    child.kill('SIGTERM');
                    setTimeout(() => {
                        if (!child.killed) {
                            child.kill('SIGKILL');
                        }
                    }, 1000);

                    // Clean up and return cancelled
                    cleanup();
                    resolve({ cancelled: true });
                    return;
                }
            };

            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }

                process.stdin.removeListener('data', keyHandler);
                if (process.stdin.setRawMode) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
            };

            process.stdin.on('data', keyHandler);

            // Handle process completion
            child.on('close', (code: number | null, signal: string | null) => {
                if (isFinished) return;
                isFinished = true;

                cleanup();

                this.logger?.debug(`FFmpeg process exited with code ${code}, signal ${signal}`);

                if (code !== 0) {
                    this.logger?.error(`FFmpeg exited with code ${code}: ${stderr}`);
                    reject(new AudioRecordingError(`FFmpeg exited with code ${code}: ${stderr}`));
                } else {
                    this.logger?.info(`✅ Recording completed successfully`);
                    resolve({ cancelled: false });
                }
            });

            // Handle process errors
            child.on('error', (error: Error) => {
                if (isFinished) return;
                isFinished = true;

                cleanup();

                this.logger?.error(`FFmpeg process error: ${error.message}`);
                reject(new Error(`Failed to execute FFmpeg: ${error.message}`));
            });
        });
    }

    /**
     * Check if key handling should be enabled based on current options
     */
    private shouldEnableKeyHandling(): boolean {
        // For now, we'll enable key handling by default during recording
        // This can be made configurable through AudioProcessingOptions in the future
        return true;
    }

    /**
     * Get audio device configuration
     */
    private async getAudioDeviceConfig(options: AudioProcessingOptions): Promise<AudioDeviceConfig> {
        let audioDevice: AudioDeviceConfig;

        if (options.audioDevice) {
            // Use specified device
            const isValid = await validateAudioDevice(options.audioDevice, this.logger);
            if (!isValid) {
                throw AudioConfigurationError.invalidConfig('audioDevice', options.audioDevice);
            }

            audioDevice = {
                audioDevice: options.audioDevice,
                audioDeviceName: `Device ${options.audioDevice}`
            };
        } else if (options.preferencesDirectory) {
            // Load from preferences
            const savedConfig = await loadAudioDeviceConfig(options.preferencesDirectory, this.logger);
            if (!savedConfig) {
                throw new AudioConfigurationError('No audio device configuration found');
            }
            audioDevice = savedConfig;
        } else {
            // Auto-detect best device
            const bestDeviceIndex = await detectBestAudioDevice(this.logger);
            audioDevice = {
                audioDevice: bestDeviceIndex,
                audioDeviceName: `Auto-detected device ${bestDeviceIndex}`
            };
        }

        return audioDevice;
    }

    /**
     * Create temporary recording directory
     */
    private async createTempRecordingDir(): Promise<string> {
        const tempBase = os.tmpdir();
        const tempDir = path.join(tempBase, `unplayable-${Date.now()}-${Math.random().toString(36).slice(2)}`);

        await this.storage.createDirectory(tempDir);
        this.logger?.debug(`Created temporary recording directory: ${tempDir}`);

        return tempDir;
    }

    /**
     * Cleanup temporary directory
     */
    private async cleanupTempDir(tempDir: string): Promise<void> {
        try {
            const files = await this.storage.listFiles(tempDir);
            for (const file of files) {
                await this.storage.deleteFile(file);
            }
            // Note: We don't remove the directory itself as fs.rmdir might require additional logic
            this.logger?.debug(`Cleaned up temporary directory: ${tempDir}`);
        } catch (error: any) {
            this.logger?.warn(`Failed to cleanup temporary directory ${tempDir}: ${error.message}`);
        }
    }

    /**
     * Handle dry run mode
     */
    private handleDryRun(options: AudioProcessingOptions): AudioProcessingResult {
        if (options.file) {
            this.logger?.info(`DRY RUN: Would process audio file: ${options.file}`);
        } else {
            this.logger?.info('DRY RUN: Would start audio recording');
        }
        return {
            cancelled: false,
            metadata: {
                processingTime: 0
            }
        };
    }
}

/**
 * Create an AudioProcessor instance
 */
export const createAudioProcessor = (logger?: Logger, config?: ConfigurationManager): AudioProcessor => {
    return new AudioProcessor(logger, config);
}; 