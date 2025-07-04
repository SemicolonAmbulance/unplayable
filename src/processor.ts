/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from 'path';
import * as os from 'os';

import {
    AudioProcessingOptions,
    AudioProcessingResult,
    AudioProcessingMetadata,
    AudioRecordingControls,
    AudioDeviceConfig,
    Logger
} from './types';
import {
    AudioRecordingError,
    AudioConfigurationError
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
 * Main audio processor class that handles recording, processing, and transcription
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
                : await this.recordAndTranscribeAudio(options);

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

        // Transcribe the audio
        this.logger?.info('🎯 Transcribing audio...');
        this.logger?.info('⏳ This may take a few seconds depending on audio length...');

        const transcription = await this.transcribeAudio(filePath);

        this.logger?.info('✅ Audio transcribed successfully');
        this.logger?.debug(`Transcription: ${transcription}`);

        // Save transcript to output directory
        let transcriptFilePath: string | undefined;
        if (options.outputDirectory) {
            transcriptFilePath = await this.saveTranscript(transcription, filePath, options.outputDirectory);
        }

        if (!transcription.trim()) {
            this.logger?.warn('No audio content was transcribed.');
            return {
                transcript: '',
                audioFilePath: filePath,
                transcriptFilePath,
                cancelled: false,
                metadata
            };
        }

        this.logger?.info('📝 Audio transcribed successfully');
        return {
            transcript: transcription,
            audioFilePath: filePath,
            transcriptFilePath,
            cancelled: false,
            metadata
        };
    }

    /**
     * Record and transcribe new audio
     */
    private async recordAndTranscribeAudio(options: AudioProcessingOptions): Promise<AudioProcessingResult> {
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
                    transcript: '',
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

            // Transcribe the recorded audio
            this.logger?.info('🎯 Transcribing recorded audio...');
            const transcription = await this.transcribeAudio(tempAudioPath);

            let finalAudioPath: string | undefined;
            let transcriptFilePath: string | undefined;

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

                // Save transcript
                transcriptFilePath = await this.saveTranscript(transcription, finalAudioPath, options.outputDirectory);
            }

            // Cleanup temp directory unless keepTemp is specified
            if (!options.keepTemp) {
                await this.cleanupTempDir(tempDir);
            } else {
                this.logger?.info(`Temporary recording kept at: ${tempDir}`);
            }

            this.logger?.info('✅ Recording and transcription completed successfully');
            return {
                transcript: transcription,
                audioFilePath: finalAudioPath,
                transcriptFilePath,
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
        this.logger?.info('⏹️ Press Ctrl+C to stop recording early');

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

            const result = await run(ffmpegPath, ffmpegArgs, {
                logger: this.logger,
                timeout: (maxTime + 5) * 1000 // Add 5 seconds buffer
            });

            if (result.code !== 0) {
                throw AudioRecordingError.recordingFailed(`FFmpeg exited with code ${result.code}: ${result.stderr}`);
            }

            this.logger?.info(`✅ Recording completed: ${outputPath}`);
            return { cancelled: false };

        } catch (error: any) {
            if (error.message?.includes('timeout')) {
                throw AudioRecordingError.recordingTimeout(maxTime);
            }

            this.logger?.error(`Recording failed: ${error.message}`);
            throw AudioRecordingError.recordingFailed(error.message);
        }
    }

    /**
     * Transcribe audio using OpenAI Whisper (placeholder - requires OpenAI SDK)
     */
    private async transcribeAudio(audioFilePath: string): Promise<string> {
        // This is a simplified version - in the full implementation, this would use the OpenAI SDK
        this.logger?.debug(`Transcribing audio file: ${audioFilePath}`);

        // For now, return a placeholder
        // TODO: Implement actual OpenAI Whisper transcription
        return `[Transcription placeholder for: ${path.basename(audioFilePath)}]`;
    }

    /**
     * Save transcript to file
     */
    private async saveTranscript(transcript: string, audioFilePath: string, outputDir: string): Promise<string> {
        const audioBaseName = path.basename(audioFilePath, path.extname(audioFilePath));
        const transcriptFileName = `${audioBaseName}-transcript.txt`;
        const transcriptPath = await generateUniqueFilename(
            path.join(outputDir, transcriptFileName),
            this.storage
        );

        await this.storage.writeFile(transcriptPath, transcript);
        this.logger?.info(`📄 Transcript saved: ${transcriptPath}`);

        return transcriptPath;
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
        this.logger?.info('DRY RUN: Would transcribe audio and return transcript');

        return {
            transcript: '[DRY RUN] Transcription would appear here',
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