/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Base error class for all Unplayable library errors
 */
export class UnplayableError extends Error {
    public readonly code: string;
    public readonly details?: any;

    constructor(message: string, code: string, details?: any) {
        super(message);
        this.name = 'UnplayableError';
        this.code = code;
        this.details = details;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UnplayableError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            stack: this.stack,
        };
    }
} 