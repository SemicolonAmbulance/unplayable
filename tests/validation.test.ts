/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    validateAudioFile,
    validateAndGetAudioFileInfo,
    hasSupportedAudioExtension,
    validateAudioFiles,
    validateAudioProcessingOptions,
    estimateAudioDuration
} from '../src/validation';
import { AudioProcessingError } from '../src/error';

// Mock fs/promises
vi.mock('fs/promises', () => ({
    access: vi.fn(),
    stat: vi.fn()
}));

describe('Audio Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('validateAudioFile', () => {
        it('should validate existing audio file with correct format', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            await expect(validateAudioFile('test.mp3')).resolves.not.toThrow();
        });

        it('should validate with logger and log debug message', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            await validateAudioFile('test.mp3', mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Audio file validation passed: test.mp3 (1024 bytes)')
            );
        });

        it('should throw error for non-existent file', async () => {
            const fs = await import('fs/promises');
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.access).mockRejectedValue(error);

            await expect(validateAudioFile('nonexistent.mp3')).rejects.toThrow(AudioProcessingError);
        });

        it('should log error when validation fails', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.access).mockRejectedValue(error);

            await expect(validateAudioFile('nonexistent.mp3', mockLogger)).rejects.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Audio file validation failed for nonexistent.mp3')
            );
        });

        it('should throw error for unsupported file format', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            await expect(validateAudioFile('test.txt')).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error for empty file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 0,
                isFile: () => true
            } as any);

            await expect(validateAudioFile('empty.mp3')).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error for very small file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 50, // Less than minimum size
                isFile: () => true
            } as any);

            await expect(validateAudioFile('tiny.mp3')).rejects.toThrow(AudioProcessingError);
        });

        it('should handle file access errors other than ENOENT', async () => {
            const fs = await import('fs/promises');
            const error = new Error('Permission denied') as any;
            error.code = 'EACCES';
            vi.mocked(fs.access).mockRejectedValue(error);

            await expect(validateAudioFile('restricted.mp3')).rejects.toThrow('Permission denied');
        });

        it('should validate files with uppercase extensions', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            await expect(validateAudioFile('test.MP3')).resolves.not.toThrow();
        });
    });

    describe('validateAndGetAudioFileInfo', () => {
        it('should return file info for valid audio file', async () => {
            const fs = await import('fs/promises');
            const mockDate = new Date('2023-01-01T00:00:00Z');

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 2048,
                isFile: () => true,
                mtime: mockDate,
                birthtime: mockDate
            } as any);

            const info = await validateAndGetAudioFileInfo('test.mp3');

            expect(info).toEqual({
                filePath: 'test.mp3',
                size: 2048,
                format: 'mp3',
                lastModified: mockDate,
                created: mockDate
            });
        });

        it('should work with logger', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };
            const mockDate = new Date('2023-01-01T00:00:00Z');

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 2048,
                isFile: () => true,
                mtime: mockDate,
                birthtime: mockDate
            } as any);

            const info = await validateAndGetAudioFileInfo('test.wav', mockLogger);

            expect(info.format).toBe('wav');
            expect(mockLogger.debug).toHaveBeenCalled();
        });

        it('should throw error for invalid file', async () => {
            const fs = await import('fs/promises');
            const error = new Error('File not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.access).mockRejectedValue(error);

            await expect(validateAndGetAudioFileInfo('invalid.mp3')).rejects.toThrow(AudioProcessingError);
        });

        it('should handle files with complex paths', async () => {
            const fs = await import('fs/promises');
            const mockDate = new Date('2023-01-01T00:00:00Z');

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true,
                mtime: mockDate,
                birthtime: mockDate
            } as any);

            const info = await validateAndGetAudioFileInfo('/path/to/audio/file.flac');
            expect(info.format).toBe('flac');
            expect(info.filePath).toBe('/path/to/audio/file.flac');
        });
    });

    describe('validateAudioFiles', () => {
        it('should validate multiple valid files', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            const results = await validateAudioFiles(['file1.mp3', 'file2.wav']);

            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({
                filePath: 'file1.mp3',
                valid: true,
                error: null
            });
            expect(results[1]).toEqual({
                filePath: 'file2.wav',
                valid: true,
                error: null
            });
        });

        it('should handle mix of valid and invalid files', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access)
                .mockResolvedValueOnce(undefined) // file1.mp3 exists
                .mockRejectedValueOnce({ code: 'ENOENT', message: 'File not found' }); // file2.mp3 doesn't exist

            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            const results = await validateAudioFiles(['file1.mp3', 'file2.mp3']);

            expect(results).toHaveLength(2);
            expect(results[0].valid).toBe(true);
            expect(results[1].valid).toBe(false);
            expect(results[1].error).toBeTruthy();
        });

        it('should work with logger', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            await validateAudioFiles(['file1.mp3'], mockLogger);
            expect(mockLogger.debug).toHaveBeenCalled();
        });

        it('should handle empty array', async () => {
            const results = await validateAudioFiles([]);
            expect(results).toHaveLength(0);
        });

        it('should handle unsupported file types', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true
            } as any);

            const results = await validateAudioFiles(['document.txt', 'audio.mp3']);

            expect(results[0].valid).toBe(false);
            expect(results[1].valid).toBe(true);
        });
    });

    describe('hasSupportedAudioExtension', () => {
        it('should return true for supported formats', () => {
            expect(hasSupportedAudioExtension('test.mp3')).toBe(true);
            expect(hasSupportedAudioExtension('test.wav')).toBe(true);
            expect(hasSupportedAudioExtension('test.flac')).toBe(true);
            expect(hasSupportedAudioExtension('test.aac')).toBe(true);
            expect(hasSupportedAudioExtension('test.m4a')).toBe(true);
            expect(hasSupportedAudioExtension('test.ogg')).toBe(true);
            expect(hasSupportedAudioExtension('test.opus')).toBe(true);
            expect(hasSupportedAudioExtension('test.webm')).toBe(true);
        });

        it('should return false for unsupported formats', () => {
            expect(hasSupportedAudioExtension('test.txt')).toBe(false);
            expect(hasSupportedAudioExtension('test.pdf')).toBe(false);
            expect(hasSupportedAudioExtension('test.doc')).toBe(false);
            expect(hasSupportedAudioExtension('test.jpg')).toBe(false);
            expect(hasSupportedAudioExtension('test.mp4')).toBe(true); // Actually supported
        });

        it('should handle case insensitive extensions', () => {
            expect(hasSupportedAudioExtension('test.MP3')).toBe(true);
            expect(hasSupportedAudioExtension('test.WAV')).toBe(true);
            expect(hasSupportedAudioExtension('test.FLAC')).toBe(true);
        });

        it('should handle files without extensions', () => {
            expect(hasSupportedAudioExtension('test')).toBe(false);
            expect(hasSupportedAudioExtension('')).toBe(false);
        });

        it('should handle files with multiple dots', () => {
            expect(hasSupportedAudioExtension('test.backup.mp3')).toBe(true);
            expect(hasSupportedAudioExtension('my.audio.file.wav')).toBe(true);
            expect(hasSupportedAudioExtension('config.json.backup')).toBe(false);
        });

        it('should handle paths with directories', () => {
            expect(hasSupportedAudioExtension('/path/to/test.mp3')).toBe(true);
            expect(hasSupportedAudioExtension('./relative/path/test.flac')).toBe(true);
            expect(hasSupportedAudioExtension('../../test.wav')).toBe(true);
        });
    });

    describe('estimateAudioDuration', () => {
        it('should estimate duration for MP3 file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 160000, // 160KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.mp3');
            expect(duration).toBe(10); // 160000 / 16000 = 10 seconds
        });

        it('should estimate duration for WAV file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 352800, // ~352KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.wav');
            expect(duration).toBe(2); // 352800 / 176400 = 2 seconds
        });

        it('should estimate duration for FLAC file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 176400, // ~176KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.flac');
            expect(duration).toBe(2); // 176400 / 88200 = 2 seconds
        });

        it('should estimate duration for AAC file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 120000, // 120KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.aac');
            expect(duration).toBe(10); // 120000 / 12000 = 10 seconds
        });

        it('should estimate duration for M4A file', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 60000, // 60KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.m4a');
            expect(duration).toBe(5); // 60000 / 12000 = 5 seconds
        });

        it('should use default estimate for less common formats', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 32000, // 32KB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('test.webm');
            expect(duration).toBe(2); // 32000 / 16000 = 2 seconds (uses default estimate)
        });

        it('should work with logger and log debug message', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };

            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 160000,
                isFile: () => true
            } as any);

            await estimateAudioDuration('test.mp3', mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Estimated duration for test.mp3: 10.0s')
            );
        });

        it('should return 0 and log error for invalid file', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                debug: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn()
            };

            const error = new Error('File not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.access).mockRejectedValue(error);

            const duration = await estimateAudioDuration('invalid.mp3', mockLogger);
            expect(duration).toBe(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to estimate duration for invalid.mp3')
            );
        });

        it('should handle very large files', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1600000000, // 1.6GB
                isFile: () => true
            } as any);

            const duration = await estimateAudioDuration('large.mp3');
            expect(duration).toBe(100000); // Very long duration
        });

        it('should handle zero-size files', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 0,
                isFile: () => true
            } as any);

            // This should fail validation first, so duration should be 0
            const duration = await estimateAudioDuration('empty.mp3');
            expect(duration).toBe(0);
        });
    });

    describe('validateAudioProcessingOptions', () => {
        it('should validate valid options', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true,
                isDirectory: () => true
            } as any);

            const validOptions = {
                file: 'test.mp3',
                maxRecordingTime: 60,
                outputDirectory: '/tmp/output'
            };

            await expect(validateAudioProcessingOptions(validOptions)).resolves.not.toThrow();
        });

        it('should validate options without file (recording mode)', async () => {
            const validOptions = {
                maxRecordingTime: 120,
                audioDevice: '1'
            };

            await expect(validateAudioProcessingOptions(validOptions)).resolves.not.toThrow();
        });

        it('should validate options with preferencesDirectory', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => true
            } as any);

            const validOptions = {
                preferencesDirectory: '/tmp/prefs',
                maxRecordingTime: 60
            };

            await expect(validateAudioProcessingOptions(validOptions)).resolves.not.toThrow();
        });

        it('should throw error for negative recording time', async () => {
            const invalidOptions = {
                maxRecordingTime: -5
            };

            await expect(validateAudioProcessingOptions(invalidOptions)).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error for zero recording time', async () => {
            const invalidOptions = {
                maxRecordingTime: 0
            };

            await expect(validateAudioProcessingOptions(invalidOptions)).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error for non-numeric recording time', async () => {
            const invalidOptions = {
                maxRecordingTime: 'not-a-number'
            };

            await expect(validateAudioProcessingOptions(invalidOptions)).rejects.toThrow(AudioProcessingError);
        });

        it('should warn about very long recording times', async () => {
            const mockLogger = {
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                debug: vi.fn()
            };

            const longRecordingOptions = {
                maxRecordingTime: 7200 // 2 hours
            };

            await validateAudioProcessingOptions(longRecordingOptions, mockLogger);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('maxRecordingTime is very long')
            );
        });

        it('should handle non-existent output directory gracefully', async () => {
            const fs = await import('fs/promises');
            const error = new Error('Directory not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const options = {
                outputDirectory: '/nonexistent/path'
            };

            // Should not throw - directory will be created when needed
            await expect(validateAudioProcessingOptions(options)).resolves.not.toThrow();
        });

        it('should log debug message for non-existent output directory', async () => {
            const fs = await import('fs/promises');
            const mockLogger = {
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                debug: vi.fn()
            };
            const error = new Error('Directory not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const options = {
                outputDirectory: '/nonexistent/path'
            };

            await validateAudioProcessingOptions(options, mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("Output directory doesn't exist, will create")
            );
        });

        it('should handle non-existent preferences directory gracefully', async () => {
            const fs = await import('fs/promises');
            const error = new Error('Directory not found') as any;
            error.code = 'ENOENT';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const options = {
                preferencesDirectory: '/nonexistent/path'
            };

            // Should not throw - directory will be created when needed
            await expect(validateAudioProcessingOptions(options)).resolves.not.toThrow();
        });

        it('should throw error if output path is not a directory', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => false
            } as any);

            const options = {
                outputDirectory: '/path/to/file.txt' // File, not directory
            };

            await expect(validateAudioProcessingOptions(options)).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error if preferences path is not a directory', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.stat).mockResolvedValue({
                isDirectory: () => false
            } as any);

            const options = {
                preferencesDirectory: '/path/to/file.txt' // File, not directory
            };

            await expect(validateAudioProcessingOptions(options)).rejects.toThrow(AudioProcessingError);
        });

        it('should throw error for other file system errors', async () => {
            const fs = await import('fs/promises');
            const error = new Error('Permission denied') as any;
            error.code = 'EACCES';
            vi.mocked(fs.stat).mockRejectedValue(error);

            const options = {
                outputDirectory: '/restricted/path'
            };

            await expect(validateAudioProcessingOptions(options)).rejects.toThrow(AudioProcessingError);
        });

        it('should log debug message on successful validation', async () => {
            const mockLogger = {
                error: vi.fn(),
                warn: vi.fn(),
                info: vi.fn(),
                debug: vi.fn()
            };

            const validOptions = {
                maxRecordingTime: 60
            };

            await validateAudioProcessingOptions(validOptions, mockLogger);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Audio processing options validation passed'
            );
        });

        it('should handle options with undefined values', async () => {
            const options = {
                maxRecordingTime: undefined,
                outputDirectory: undefined,
                preferencesDirectory: undefined,
                file: undefined
            };

            await expect(validateAudioProcessingOptions(options)).resolves.not.toThrow();
        });

        it('should validate all options together', async () => {
            const fs = await import('fs/promises');
            vi.mocked(fs.access).mockResolvedValue(undefined);
            vi.mocked(fs.stat).mockResolvedValue({
                size: 1024,
                isFile: () => true,
                isDirectory: () => true
            } as any);

            const complexOptions = {
                file: 'input.wav',
                maxRecordingTime: 120,
                outputDirectory: '/tmp/output',
                preferencesDirectory: '/tmp/prefs',
                audioDevice: '2'
            };

            await expect(validateAudioProcessingOptions(complexOptions)).resolves.not.toThrow();
        });
    });
}); 