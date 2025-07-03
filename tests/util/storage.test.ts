import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock the fs module - declarations moved after mocks

vi.mock('fs/promises', () => ({
    stat: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    copyFile: vi.fn(),
    rename: vi.fn()
}));

// Import the mocked functions
import * as fs from 'fs/promises';
const mockStat = vi.mocked(fs.stat);
const mockAccess = vi.mocked(fs.access);
const mockMkdir = vi.mocked(fs.mkdir);
const mockReadFile = vi.mocked(fs.readFile);
const mockWriteFile = vi.mocked(fs.writeFile);
const mockUnlink = vi.mocked(fs.unlink);
const mockCopyFile = vi.mocked(fs.copyFile);
const mockRename = vi.mocked(fs.rename);

vi.mock('fs', () => ({
    constants: {
        R_OK: 4,
        W_OK: 2
    }
}));

// Mock glob
const mockGlob = vi.fn();
vi.mock('glob', () => ({
    glob: mockGlob
}));

// Mock crypto module
const mockCrypto = {
    createHash: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('0123456789abcdef0123456789abcdef01234567')
    })
};

vi.mock('crypto', () => ({
    createHash: mockCrypto.createHash
}));

// Import the storage module after mocking
let storageModule: any;

describe('Storage Utility', () => {
    const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    };
    let storage: any;

    beforeAll(async () => {
        storageModule = await import('../../src/util/storage');
    });

    beforeEach(() => {
        vi.resetAllMocks();

        // Re-setup crypto mock after resetAllMocks
        mockCrypto.createHash.mockReturnValue({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('0123456789abcdef0123456789abcdef01234567')
        });

        storage = storageModule.createStorage({ logger: mockLogger });
    });

    describe('exists', () => {
        it('should return true if path exists', async () => {
            mockAccess.mockResolvedValueOnce(undefined);

            const result = await storage.exists('/test/path');

            expect(result).toBe(true);
            expect(mockAccess).toHaveBeenCalledWith('/test/path');
        });

        it('should return false if path does not exist', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Path does not exist'));

            const result = await storage.exists('/test/path');

            expect(result).toBe(false);
            expect(mockAccess).toHaveBeenCalledWith('/test/path');
        });
    });

    describe('isDirectory', () => {
        it('should return true if path is a directory', async () => {
            mockStat.mockResolvedValueOnce({
                isDirectory: () => true,
                isFile: () => false
            } as any);

            const result = await storage.isDirectory('/test/dir');

            expect(result).toBe(true);
            expect(mockStat).toHaveBeenCalledWith('/test/dir');
        });

        it('should return false if path is not a directory', async () => {
            mockStat.mockResolvedValueOnce({
                isDirectory: () => false,
                isFile: () => true
            } as any);

            const result = await storage.isDirectory('/test/file');

            expect(result).toBe(false);
            expect(mockStat).toHaveBeenCalledWith('/test/file');
        });

        it('should return false if stat fails', async () => {
            mockStat.mockRejectedValueOnce(new Error('Stat failed'));

            const result = await storage.isDirectory('/test/path');

            expect(result).toBe(false);
        });
    });

    describe('isFile', () => {
        it('should return true if path is a file', async () => {
            mockStat.mockResolvedValueOnce({
                isFile: () => true,
                isDirectory: () => false
            } as any);

            const result = await storage.isFile('/test/file.txt');

            expect(result).toBe(true);
            expect(mockStat).toHaveBeenCalledWith('/test/file.txt');
        });

        it('should return false if path is not a file', async () => {
            mockStat.mockResolvedValueOnce({
                isFile: () => false,
                isDirectory: () => true
            } as any);

            const result = await storage.isFile('/test/dir');

            expect(result).toBe(false);
            expect(mockStat).toHaveBeenCalledWith('/test/dir');
        });

        it('should return false if stat fails', async () => {
            mockStat.mockRejectedValueOnce(new Error('Stat failed'));

            const result = await storage.isFile('/test/path');

            expect(result).toBe(false);
        });
    });

    describe('isReadable', () => {
        it('should return true if path is readable', async () => {
            mockAccess.mockResolvedValueOnce(undefined);

            const result = await storage.isReadable('/test/file.txt');

            expect(result).toBe(true);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 4);
        });

        it('should return false if path is not readable', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Not readable'));

            const result = await storage.isReadable('/test/file.txt');

            expect(result).toBe(false);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 4);
        });
    });

    describe('isWritable', () => {
        it('should return true if path is writable', async () => {
            mockAccess.mockResolvedValueOnce(undefined);

            const result = await storage.isWritable('/test/file.txt');

            expect(result).toBe(true);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 2);
        });

        it('should return false if path is not writable', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Not writable'));

            const result = await storage.isWritable('/test/file.txt');

            expect(result).toBe(false);
            expect(mockAccess).toHaveBeenCalledWith('/test/file.txt', 2);
        });
    });

    describe('createDirectory', () => {
        it('should create directory successfully', async () => {
            mockMkdir.mockResolvedValueOnce(undefined);

            await storage.createDirectory('/test/dir');

            expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
            expect(mockLogger.debug).toHaveBeenCalledWith('Directory created: /test/dir');
        });

        it('should throw error if directory creation fails', async () => {
            const originalError = new Error('Permission denied');
            mockMkdir.mockRejectedValueOnce(originalError);

            await expect(storage.createDirectory('/test/dir')).rejects.toThrow(
                'Failed to create directory: Permission denied'
            );

            expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('readFile', () => {
        it('should read file successfully', async () => {
            mockStat.mockResolvedValueOnce({
                size: 1024
            } as any);
            mockReadFile.mockResolvedValueOnce('file content');

            const result = await storage.readFile('/test/file.txt', 'utf8');

            expect(result).toBe('file content');
            expect(mockStat).toHaveBeenCalledWith('/test/file.txt');
            expect(mockReadFile).toHaveBeenCalledWith('/test/file.txt', { encoding: 'utf8' });
            expect(mockLogger.debug).toHaveBeenCalledWith('File read: /test/file.txt (1024 bytes)');
        });

        it('should throw error for invalid encoding', async () => {
            await expect(storage.readFile('/test/file.txt', 'invalid-encoding')).rejects.toThrow(
                'Invalid encoding specified'
            );

            expect(mockStat).not.toHaveBeenCalled();
            expect(mockReadFile).not.toHaveBeenCalled();
        });

        it('should throw error for file too large', async () => {
            mockStat.mockResolvedValueOnce({
                size: 15 * 1024 * 1024 // 15MB - exceeds 10MB limit
            } as any);

            await expect(storage.readFile('/test/large-file.txt', 'utf8')).rejects.toThrow(
                'File too large to process'
            );

            expect(mockStat).toHaveBeenCalledWith('/test/large-file.txt');
            expect(mockReadFile).not.toHaveBeenCalled();
        });

        it('should handle file not found', async () => {
            const enoentError = new Error('ENOENT: no such file or directory');
            (enoentError as any).code = 'ENOENT';
            mockStat.mockRejectedValueOnce(enoentError);

            await expect(storage.readFile('/test/nonexistent.txt', 'utf8')).rejects.toThrow();

            expect(mockStat).toHaveBeenCalledWith('/test/nonexistent.txt');
            expect(mockReadFile).not.toHaveBeenCalled();
        });
    });

    describe('writeFile', () => {
        it('should write file successfully', async () => {
            // Mock ensureDirectory calls
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockWriteFile.mockResolvedValueOnce(undefined);

            await storage.writeFile('/test/file.txt', 'file content', 'utf8');

            expect(mockWriteFile).toHaveBeenCalledWith('/test/file.txt', 'file content', { encoding: 'utf8' });
            expect(mockLogger.debug).toHaveBeenCalledWith('File written: /test/file.txt');
        });

        it('should write file with Buffer data', async () => {
            // Mock ensureDirectory calls
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockWriteFile.mockResolvedValueOnce(undefined);
            const buffer = Buffer.from('file content');

            await storage.writeFile('/test/file.txt', buffer, 'utf8');

            expect(mockWriteFile).toHaveBeenCalledWith('/test/file.txt', buffer, { encoding: 'utf8' });
        });

        it('should handle write errors', async () => {
            // Mock ensureDirectory calls
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'));

            await expect(storage.writeFile('/test/file.txt', 'content', 'utf8')).rejects.toThrow(
                'Failed to write file: Permission denied'
            );

            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('deleteFile', () => {
        it('should delete file successfully', async () => {
            mockUnlink.mockResolvedValueOnce(undefined);

            await storage.deleteFile('/test/file.txt');

            expect(mockUnlink).toHaveBeenCalledWith('/test/file.txt');
            expect(mockLogger.debug).toHaveBeenCalledWith('File deleted: /test/file.txt');
        });

        it('should handle file not found (no error)', async () => {
            const enoentError = new Error('ENOENT: no such file or directory');
            (enoentError as any).code = 'ENOENT';
            mockUnlink.mockRejectedValueOnce(enoentError);

            await storage.deleteFile('/test/nonexistent.txt');

            expect(mockUnlink).toHaveBeenCalledWith('/test/nonexistent.txt');
            // Should not throw error for ENOENT
        });

        it('should handle other delete errors', async () => {
            mockUnlink.mockRejectedValueOnce(new Error('Permission denied'));

            await expect(storage.deleteFile('/test/file.txt')).rejects.toThrow(
                'Failed to delete file: Permission denied'
            );
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('copyFile', () => {
        it('should copy file successfully', async () => {
            // Mock ensureDirectory calls for destination
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockCopyFile.mockResolvedValueOnce(undefined);

            await storage.copyFile('/test/source.txt', '/test/dest.txt');

            expect(mockCopyFile).toHaveBeenCalledWith('/test/source.txt', '/test/dest.txt');
            expect(mockLogger.debug).toHaveBeenCalledWith('File copied: /test/source.txt -> /test/dest.txt');
        });

        it('should handle copy errors', async () => {
            // Mock ensureDirectory calls for destination
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockCopyFile.mockRejectedValueOnce(new Error('Copy failed'));

            await expect(storage.copyFile('/test/source.txt', '/test/dest.txt')).rejects.toThrow(
                'Failed to copy file: Copy failed'
            );
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('moveFile', () => {
        it('should move file successfully', async () => {
            // Mock ensureDirectory calls for destination
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockRename.mockResolvedValueOnce(undefined);

            await storage.moveFile('/test/source.txt', '/test/dest.txt');

            expect(mockRename).toHaveBeenCalledWith('/test/source.txt', '/test/dest.txt');
            expect(mockLogger.debug).toHaveBeenCalledWith('File moved: /test/source.txt -> /test/dest.txt');
        });

        it('should handle move errors', async () => {
            // Mock ensureDirectory calls for destination
            mockAccess.mockResolvedValueOnce(undefined); // exists check
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory check
            mockRename.mockRejectedValueOnce(new Error('Move failed'));

            await expect(storage.moveFile('/test/source.txt', '/test/dest.txt')).rejects.toThrow(
                'Failed to move file: Move failed'
            );
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('listFiles', () => {
        it('should list files in directory', async () => {
            mockGlob.mockResolvedValueOnce(['file1.txt', 'file2.txt']);

            const result = await storage.listFiles('/test/dir', '*');

            expect(result).toEqual(['/test/dir/file1.txt', '/test/dir/file2.txt']);
            expect(mockGlob).toHaveBeenCalledWith('*', {
                cwd: '/test/dir',
                nodir: true,
                absolute: false
            });
            expect(mockLogger.debug).toHaveBeenCalledWith('Listed 2 files in /test/dir matching *');
        });

        it('should handle default pattern', async () => {
            mockGlob.mockResolvedValueOnce(['file1.txt']);

            const result = await storage.listFiles('/test/dir');

            expect(mockGlob).toHaveBeenCalledWith('*', {
                cwd: '/test/dir',
                nodir: true,
                absolute: false
            });
        });

        it('should handle glob errors', async () => {
            mockGlob.mockRejectedValueOnce(new Error('Glob error'));

            await expect(storage.listFiles('/test/dir')).rejects.toThrow(
                'Failed to list files: Glob error'
            );
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('getFileStats', () => {
        it('should get file stats successfully', async () => {
            const mockStats = {
                size: 1024,
                mtime: new Date(),
                isFile: () => true,
                isDirectory: () => false
            };
            mockStat.mockResolvedValueOnce(mockStats as any);

            const result = await storage.getFileStats('/test/file.txt');

            expect(result).toBe(mockStats);
            expect(mockStat).toHaveBeenCalledWith('/test/file.txt');
        });

        it('should handle file not found', async () => {
            const enoentError = new Error('ENOENT: no such file or directory');
            (enoentError as any).code = 'ENOENT';
            mockStat.mockRejectedValueOnce(enoentError);

            await expect(storage.getFileStats('/test/nonexistent.txt')).rejects.toThrow();
        });

        it('should handle other stat errors', async () => {
            mockStat.mockRejectedValueOnce(new Error('Permission denied'));

            await expect(storage.getFileStats('/test/file.txt')).rejects.toThrow(
                'Failed to get file stats: Permission denied'
            );
        });
    });

    describe('ensureDirectory', () => {
        it('should do nothing if directory exists', async () => {
            mockAccess.mockResolvedValueOnce(undefined); // exists
            mockStat.mockResolvedValueOnce({ isDirectory: () => true } as any); // isDirectory

            await storage.ensureDirectory('/test/dir');

            expect(mockAccess).toHaveBeenCalledWith('/test/dir');
            expect(mockStat).toHaveBeenCalledWith('/test/dir');
            expect(mockMkdir).not.toHaveBeenCalled();
        });

        it('should create directory if it does not exist', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Does not exist')); // does not exist
            mockMkdir.mockResolvedValueOnce(undefined);

            await storage.ensureDirectory('/test/dir');

            expect(mockAccess).toHaveBeenCalledWith('/test/dir');
            expect(mockMkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
        });

        it('should throw error if path exists but is not a directory', async () => {
            mockAccess.mockResolvedValueOnce(undefined); // exists
            mockStat.mockResolvedValueOnce({ isDirectory: () => false } as any); // not a directory

            await expect(storage.ensureDirectory('/test/file.txt')).rejects.toThrow(
                'Path exists but is not a directory: /test/file.txt'
            );
        });
    });

    describe('cleanupDirectory', () => {
        it('should cleanup old files', async () => {
            const now = Date.now();
            const oldTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
            const newTime = now - (1 * 60 * 60 * 1000); // 1 hour ago

            // exists
            mockAccess.mockResolvedValueOnce(undefined);

            // listFiles
            mockGlob.mockResolvedValueOnce(['old-file.txt', 'new-file.txt']);

            // getFileStats for old file
            mockStat.mockResolvedValueOnce({
                mtime: new Date(oldTime),
                isFile: () => true
            } as any);

            // getFileStats for new file
            mockStat.mockResolvedValueOnce({
                mtime: new Date(newTime),
                isFile: () => true
            } as any);

            // deleteFile
            mockUnlink.mockResolvedValueOnce(undefined);

            const result = await storage.cleanupDirectory('/test/dir');

            expect(result).toBe(1); // Should delete 1 old file
            expect(mockUnlink).toHaveBeenCalledWith('/test/dir/old-file.txt');
            expect(mockLogger.debug).toHaveBeenCalledWith('Cleaned up 1 files from /test/dir');
        });

        it('should return 0 if directory does not exist', async () => {
            mockAccess.mockRejectedValueOnce(new Error('Does not exist'));

            const result = await storage.cleanupDirectory('/test/nonexistent');

            expect(result).toBe(0);
        });

        it('should handle cleanup errors', async () => {
            mockAccess.mockResolvedValueOnce(undefined); // exists
            mockGlob.mockRejectedValueOnce(new Error('Glob error')); // listFiles fails

            await expect(storage.cleanupDirectory('/test/dir')).rejects.toThrow(
                'Failed to cleanup directory: Failed to list files: Glob error'
            );
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('standalone functions', () => {
        describe('hashFile', () => {
            it('should hash file content', async () => {
                mockReadFile.mockResolvedValueOnce(Buffer.from('file content'));

                const result = await storageModule.hashFile('/test/file.txt', 'sha256', 8);

                expect(result).toBe('01234567');
                expect(mockReadFile).toHaveBeenCalledWith('/test/file.txt');
                expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
            });

            it('should handle read file errors', async () => {
                mockReadFile.mockRejectedValueOnce(new Error('File read error'));

                await expect(storageModule.hashFile('/test/file.txt')).rejects.toThrow(
                    'Failed to hash file: File read error'
                );
            });
        });

        describe('generateTimestampedFilename', () => {
            it('should generate timestamped filename', () => {
                const result = storageModule.generateTimestampedFilename('test', 'txt');

                expect(result).toMatch(/^test-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.txt$/);
            });

            it('should use default values', () => {
                const result = storageModule.generateTimestampedFilename();

                expect(result).toMatch(/^audio-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.wav$/);
            });
        });

        describe('generateUniqueFilename', () => {
            it('should return original path if file does not exist', async () => {
                const mockStorage = {
                    exists: vi.fn().mockResolvedValue(false)
                };

                const result = await storageModule.generateUniqueFilename('/test/file.txt', mockStorage);

                expect(result).toBe('/test/file.txt');
                expect(mockStorage.exists).toHaveBeenCalledWith('/test/file.txt');
            });

            it('should add counter if file exists', async () => {
                const mockStorage = {
                    exists: vi.fn()
                        .mockResolvedValueOnce(true)  // /test/file.txt exists
                        .mockResolvedValueOnce(true)  // /test/file-1.txt exists
                        .mockResolvedValueOnce(false) // /test/file-2.txt does not exist
                };

                const result = await storageModule.generateUniqueFilename('/test/file.txt', mockStorage);

                expect(result).toBe('/test/file-2.txt');
                expect(mockStorage.exists).toHaveBeenCalledTimes(3);
            });
        });

        describe('getDirectorySize', () => {
            it('should calculate directory size', async () => {
                mockGlob.mockResolvedValueOnce(['file1.txt', 'file2.txt']);
                mockStat
                    .mockResolvedValueOnce({ isFile: () => true, size: 100 } as any)
                    .mockResolvedValueOnce({ isFile: () => true, size: 200 } as any);

                const result = await storageModule.getDirectorySize('/test/dir');

                expect(result).toBe(300);
                expect(mockGlob).toHaveBeenCalledWith('**/*', {
                    cwd: '/test/dir',
                    nodir: true,
                    absolute: false
                });
            });

            it('should handle stat errors gracefully', async () => {
                mockGlob.mockResolvedValueOnce(['file1.txt', 'file2.txt']);
                mockStat
                    .mockResolvedValueOnce({ isFile: () => true, size: 100 } as any)
                    .mockRejectedValueOnce(new Error('Stat failed')); // Second file fails

                const result = await storageModule.getDirectorySize('/test/dir');

                expect(result).toBe(100); // Only counts first file
            });

            it('should handle glob errors', async () => {
                mockGlob.mockRejectedValueOnce(new Error('Glob error'));

                await expect(storageModule.getDirectorySize('/test/dir')).rejects.toThrow(
                    'Failed to get directory size: Failed to list files: Glob error'
                );
            });
        });
    });
});
