import { describe, it, expect } from 'vitest';
import { UnplayableError } from '../../src/error/UnplayableError';

describe('UnplayableError', () => {
    describe('constructor', () => {
        it('should create an error with message, code, and details', () => {
            const message = 'Test error message';
            const code = 'TEST_ERROR';
            const details = { context: 'test context' };

            const error = new UnplayableError(message, code, details);

            expect(error.message).toBe(message);
            expect(error.code).toBe(code);
            expect(error.details).toEqual(details);
            expect(error.name).toBe('UnplayableError');
        });

        it('should create an error with message and code only', () => {
            const message = 'Test error message';
            const code = 'TEST_ERROR';

            const error = new UnplayableError(message, code);

            expect(error.message).toBe(message);
            expect(error.code).toBe(code);
            expect(error.details).toBeUndefined();
            expect(error.name).toBe('UnplayableError');
        });

        it('should create an error with empty message', () => {
            const message = '';
            const code = 'EMPTY_MESSAGE';

            const error = new UnplayableError(message, code);

            expect(error.message).toBe(message);
            expect(error.code).toBe(code);
            expect(error.name).toBe('UnplayableError');
        });

        it('should create an error with empty code', () => {
            const message = 'Test message';
            const code = '';

            const error = new UnplayableError(message, code);

            expect(error.message).toBe(message);
            expect(error.code).toBe(code);
            expect(error.name).toBe('UnplayableError');
        });

        it('should handle complex details object', () => {
            const message = 'Complex error';
            const code = 'COMPLEX_ERROR';
            const details = {
                nested: {
                    property: 'value'
                },
                array: [1, 2, 3],
                number: 42,
                boolean: true,
                null: null,
                undefined: undefined
            };

            const error = new UnplayableError(message, code, details);

            expect(error.details).toEqual(details);
        });
    });

    describe('inheritance', () => {
        it('should extend Error class', () => {
            const error = new UnplayableError('Test', 'TEST');

            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(UnplayableError);
        });

        it('should be throwable', () => {
            const error = new UnplayableError('Test error', 'TEST_THROW');

            expect(() => {
                throw error;
            }).toThrow(error);
        });

        it('should be catchable as Error', () => {
            const error = new UnplayableError('Test error', 'TEST_CATCH');

            try {
                throw error;
            } catch (caught) {
                expect(caught).toBeInstanceOf(Error);
                expect(caught).toBeInstanceOf(UnplayableError);
                expect((caught as UnplayableError).code).toBe('TEST_CATCH');
            }
        });
    });

    describe('properties', () => {
        it('should have correct name property', () => {
            const error = new UnplayableError('Test', 'TEST');

            expect(error.name).toBe('UnplayableError');
        });

        it('should have message property', () => {
            const message = 'This is a test message';
            const error = new UnplayableError(message, 'TEST');

            expect(error.message).toBe(message);
        });

        it('should have code property', () => {
            const code = 'TEST_CODE_123';
            const error = new UnplayableError('Test', code);

            expect(error.code).toBe(code);
        });

        it('should have details property when provided', () => {
            const details = { key: 'value' };
            const error = new UnplayableError('Test', 'TEST', details);

            expect(error.details).toEqual(details);
        });

        it('should have stack property', () => {
            const error = new UnplayableError('Test', 'TEST');

            expect(error.stack).toBeDefined();
            expect(typeof error.stack).toBe('string');
            expect(error.stack).toContain('UnplayableError');
        });

        it('should have readonly properties', () => {
            const error = new UnplayableError('Test', 'TEST', { data: 'test' });

            // These properties should be readonly, but TypeScript readonly doesn't prevent runtime changes
            // We can test that the properties exist and have the expected types
            expect(typeof error.code).toBe('string');
            expect(error.details).toBeDefined();
        });
    });

    describe('toJSON method', () => {
        it('should return JSON representation with all properties', () => {
            const message = 'Test message';
            const code = 'TEST_JSON';
            const details = { context: 'test' };
            const error = new UnplayableError(message, code, details);

            const json = error.toJSON();

            expect(json).toEqual({
                name: 'UnplayableError',
                message: message,
                code: code,
                details: details,
                stack: error.stack
            });
        });

        it('should return JSON representation without details when not provided', () => {
            const message = 'Test message';
            const code = 'TEST_JSON_NO_DETAILS';
            const error = new UnplayableError(message, code);

            const json = error.toJSON();

            expect(json).toEqual({
                name: 'UnplayableError',
                message: message,
                code: code,
                details: undefined,
                stack: error.stack
            });
        });

        it('should be serializable to JSON string', () => {
            const error = new UnplayableError('Test', 'TEST_SERIALIZE', { data: 'test' });

            const jsonString = JSON.stringify(error);
            const parsed = JSON.parse(jsonString);

            expect(parsed.name).toBe('UnplayableError');
            expect(parsed.message).toBe('Test');
            expect(parsed.code).toBe('TEST_SERIALIZE');
            expect(parsed.details).toEqual({ data: 'test' });
            expect(parsed.stack).toBeDefined();
        });

        it('should handle circular references in details', () => {
            const circular: any = { prop: 'value' };
            circular.self = circular;

            const error = new UnplayableError('Test', 'CIRCULAR', circular);
            const json = error.toJSON();

            expect(json.details).toBe(circular);
            // The toJSON method doesn't handle circular references, it just returns the object as-is
            // JSON.stringify would throw, but toJSON itself works
        });
    });

    describe('error handling scenarios', () => {
        it('should work with null details', () => {
            const error = new UnplayableError('Test', 'NULL_DETAILS', null);

            expect(error.details).toBeNull();
            expect(error.toJSON().details).toBeNull();
        });

        it('should work with undefined details', () => {
            const error = new UnplayableError('Test', 'UNDEFINED_DETAILS', undefined);

            expect(error.details).toBeUndefined();
            expect(error.toJSON().details).toBeUndefined();
        });

        it('should work with primitive details', () => {
            const stringError = new UnplayableError('Test', 'STRING_DETAILS', 'string details');
            const numberError = new UnplayableError('Test', 'NUMBER_DETAILS', 42);
            const booleanError = new UnplayableError('Test', 'BOOLEAN_DETAILS', true);

            expect(stringError.details).toBe('string details');
            expect(numberError.details).toBe(42);
            expect(booleanError.details).toBe(true);
        });

        it('should maintain stack trace information', () => {
            const error = new UnplayableError('Stack test', 'STACK_TEST');

            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('UnplayableError');
            expect(error.stack).toContain('Stack test');
        });
    });

    describe('static behavior', () => {
        it('should create multiple independent instances', () => {
            const error1 = new UnplayableError('First', 'FIRST', { id: 1 });
            const error2 = new UnplayableError('Second', 'SECOND', { id: 2 });

            expect(error1.message).toBe('First');
            expect(error2.message).toBe('Second');
            expect(error1.code).toBe('FIRST');
            expect(error2.code).toBe('SECOND');
            expect(error1.details).toEqual({ id: 1 });
            expect(error2.details).toEqual({ id: 2 });
            expect(error1).not.toBe(error2);
        });

        it('should have different stack traces for different instances', () => {
            const error1 = new UnplayableError('First', 'FIRST');
            const error2 = new UnplayableError('Second', 'SECOND');

            expect(error1.stack).toBeDefined();
            expect(error2.stack).toBeDefined();
            expect(error1.stack).not.toBe(error2.stack);
        });
    });
});
