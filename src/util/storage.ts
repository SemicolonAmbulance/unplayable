/* eslint-disable @typescript-eslint/no-explicit-any */
import * as fs from 'fs/promises';
import { Stats, constants } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

import { glob } from 'glob';

import { AudioProcessingError } from '../error';
import { Logger } from '../types';

/**
 * Storage utility interface for file operations
 */
export interface StorageUtility {
    exists: (path: string) => Promise<boolean>;
    isDirectory: (path: string) => Promise<boolean>;
    isFile: (path: string) => Promise<boolean>;
    isReadable: (path: string) => Promise<boolean>;
    isWritable: (path: string) => Promise<boolean>;
    createDirectory: (path: string) => Promise<void>;
    readFile: (path: string, encoding?: string) => Promise<string>;
    writeFile: (path: string, data: string | Buffer, encoding?: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    copyFile: (source: string, destination: string) => Promise<void>;
    moveFile: (source: string, destination: string) => Promise<void>;
    listFiles: (directory: string, pattern?: string) => Promise<string[]>;
    getFileStats: (path: string) => Promise<Stats>;
    ensureDirectory: (path: string) => Promise<void>;
    cleanupDirectory: (path: string, maxAge?: number) => Promise<number>;
}

/**
 * Creates a storage utility instance with optional logging
 * @param options Configuration options
 * @returns Storage utility instance
 */
export const createStorage = (options: { logger?: Logger } = {}): StorageUtility => {
    const { logger } = options;

    const exists = async (filePath: string): Promise<boolean> => {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    };

    const isDirectory = async (filePath: string): Promise<boolean> => {
        try {
            const stats = await fs.stat(filePath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    };

    const isFile = async (filePath: string): Promise<boolean> => {
        try {
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch {
            return false;
        }
    };

    const isReadable = async (filePath: string): Promise<boolean> => {
        try {
            await fs.access(filePath, constants.R_OK);
            return true;
        } catch {
            return false;
        }
    };

    const isWritable = async (filePath: string): Promise<boolean> => {
        try {
            await fs.access(filePath, constants.W_OK);
            return true;
        } catch {
            return false;
        }
    };

    const createDirectory = async (dirPath: string): Promise<void> => {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            logger?.debug(`Directory created: ${dirPath}`);
        } catch (error: any) {
            logger?.error(`Failed to create directory ${dirPath}: ${error.message}`);
            throw new AudioProcessingError(`Failed to create directory: ${error.message}`);
        }
    };

    const ensureDirectory = async (dirPath: string): Promise<void> => {
        if (!(await exists(dirPath))) {
            await createDirectory(dirPath);
        } else if (!(await isDirectory(dirPath))) {
            throw new AudioProcessingError(`Path exists but is not a directory: ${dirPath}`);
        }
    };

    const readFile = async (filePath: string, encoding: string = 'utf8'): Promise<string> => {
        try {
            // Validate encoding parameter
            const validEncodings = ['utf8', 'utf-8', 'ascii', 'latin1', 'base64', 'hex', 'utf16le', 'ucs2', 'ucs-2'];
            if (!validEncodings.includes(encoding.toLowerCase())) {
                throw new Error('Invalid encoding specified');
            }

            // Check file size before reading to prevent DoS
            const stats = await fs.stat(filePath);
            const maxFileSize = 10 * 1024 * 1024; // 10MB limit
            if (stats.size > maxFileSize) {
                throw new Error('File too large to process');
            }

            const content = await fs.readFile(filePath, { encoding: encoding as 'utf8' | 'utf-8' | 'ascii' | 'latin1' | 'base64' | 'hex' | 'utf16le' | 'ucs2' | 'ucs-2' });
            logger?.debug(`File read: ${filePath} (${stats.size} bytes)`);
            return content;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw AudioProcessingError.fileNotFound(filePath);
            }
            logger?.error(`Failed to read file ${filePath}: ${error.message}`);
            throw new AudioProcessingError(`Failed to read file: ${error.message}`);
        }
    };

    const writeFile = async (filePath: string, data: string | Buffer, encoding: string = 'utf8'): Promise<void> => {
        try {
            // Ensure parent directory exists
            const parentDir = path.dirname(filePath);
            await ensureDirectory(parentDir);

            await fs.writeFile(filePath, data, { encoding: encoding as 'utf8' | 'utf-8' | 'ascii' | 'latin1' | 'base64' | 'hex' | 'utf16le' | 'ucs2' | 'ucs-2' });
            logger?.debug(`File written: ${filePath}`);
        } catch (error: any) {
            logger?.error(`Failed to write file ${filePath}: ${error.message}`);
            throw new AudioProcessingError(`Failed to write file: ${error.message}`);
        }
    };

    const deleteFile = async (filePath: string): Promise<void> => {
        try {
            await fs.unlink(filePath);
            logger?.debug(`File deleted: ${filePath}`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, which is fine
                return;
            }
            logger?.error(`Failed to delete file ${filePath}: ${error.message}`);
            throw new AudioProcessingError(`Failed to delete file: ${error.message}`);
        }
    };

    const copyFile = async (source: string, destination: string): Promise<void> => {
        try {
            // Ensure destination directory exists
            const parentDir = path.dirname(destination);
            await ensureDirectory(parentDir);

            await fs.copyFile(source, destination);
            logger?.debug(`File copied: ${source} -> ${destination}`);
        } catch (error: any) {
            logger?.error(`Failed to copy file ${source} -> ${destination}: ${error.message}`);
            throw new AudioProcessingError(`Failed to copy file: ${error.message}`);
        }
    };

    const moveFile = async (source: string, destination: string): Promise<void> => {
        try {
            // Ensure destination directory exists
            const parentDir = path.dirname(destination);
            await ensureDirectory(parentDir);

            await fs.rename(source, destination);
            logger?.debug(`File moved: ${source} -> ${destination}`);
        } catch (error: any) {
            logger?.error(`Failed to move file ${source} -> ${destination}: ${error.message}`);
            throw new AudioProcessingError(`Failed to move file: ${error.message}`);
        }
    };

    const listFiles = async (directory: string, pattern: string = '*'): Promise<string[]> => {
        try {
            const files = await glob(pattern, {
                cwd: directory,
                nodir: true,
                absolute: false
            });

            logger?.debug(`Listed ${files.length} files in ${directory} matching ${pattern}`);
            return files.map(file => path.join(directory, file));
        } catch (error: any) {
            logger?.error(`Failed to list files in ${directory}: ${error.message}`);
            throw new AudioProcessingError(`Failed to list files: ${error.message}`);
        }
    };

    const getFileStats = async (filePath: string): Promise<Stats> => {
        try {
            return await fs.stat(filePath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                throw AudioProcessingError.fileNotFound(filePath);
            }
            throw new AudioProcessingError(`Failed to get file stats: ${error.message}`);
        }
    };

    const cleanupDirectory = async (directory: string, maxAge: number = 24 * 60 * 60 * 1000): Promise<number> => {
        try {
            if (!(await exists(directory))) {
                return 0;
            }

            const files = await listFiles(directory, '*');
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                try {
                    const stats = await getFileStats(file);
                    const age = now - stats.mtime.getTime();

                    if (age > maxAge) {
                        await deleteFile(file);
                        deletedCount++;
                    }
                } catch (error) {
                    logger?.warn(`Failed to process file ${file} during cleanup: ${error}`);
                }
            }

            logger?.debug(`Cleaned up ${deletedCount} files from ${directory}`);
            return deletedCount;
        } catch (error: any) {
            logger?.error(`Failed to cleanup directory ${directory}: ${error.message}`);
            throw new AudioProcessingError(`Failed to cleanup directory: ${error.message}`);
        }
    };

    return {
        exists,
        isDirectory,
        isFile,
        isReadable,
        isWritable,
        createDirectory,
        readFile,
        writeFile,
        deleteFile,
        copyFile,
        moveFile,
        listFiles,
        getFileStats,
        ensureDirectory,
        cleanupDirectory,
    };
};

/**
 * Generates a timestamped filename for audio files
 * @param prefix Optional prefix for the filename
 * @param extension File extension (without dot)
 * @returns Timestamped filename
 */
export const generateTimestampedFilename = (prefix: string = 'audio', extension: string = 'wav'): string => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.${extension}`;
};

/**
 * Generates a unique filename by adding a suffix if the file already exists
 * @param basePath Base file path
 * @param storage Storage utility instance
 * @returns Promise resolving to unique file path
 */
export const generateUniqueFilename = async (basePath: string, storage: StorageUtility): Promise<string> => {
    let counter = 0;
    let candidatePath = basePath;

    while (await storage.exists(candidatePath)) {
        counter++;
        const ext = path.extname(basePath);
        const base = basePath.slice(0, -ext.length);
        candidatePath = `${base}-${counter}${ext}`;
    }

    return candidatePath;
};

/**
 * Creates a hash of file contents
 * @param filePath Path to the file
 * @param algorithm Hash algorithm to use
 * @param length Length of hash to return (truncated)
 * @returns Promise resolving to file hash
 */
export const hashFile = async (filePath: string, algorithm: string = 'sha256', length: number = 8): Promise<string> => {
    try {
        const content = await fs.readFile(filePath);
        const hash = crypto.createHash(algorithm).update(content).digest('hex');
        return hash.slice(0, length);
    } catch (error: any) {
        throw new AudioProcessingError(`Failed to hash file: ${error.message}`);
    }
};

/**
 * Gets the size of a directory recursively
 * @param dirPath Directory path
 * @returns Promise resolving to total size in bytes
 */
export const getDirectorySize = async (dirPath: string): Promise<number> => {
    try {
        const storage = createStorage();
        const files = await storage.listFiles(dirPath, '**/*');
        let totalSize = 0;

        for (const file of files) {
            try {
                const stats = await storage.getFileStats(file);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            } catch {
                // Skip files that can't be accessed
            }
        }

        return totalSize;
    } catch (error: any) {
        throw new AudioProcessingError(`Failed to get directory size: ${error.message}`);
    }
}; 