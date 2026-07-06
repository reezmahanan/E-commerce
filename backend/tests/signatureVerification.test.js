const { verifyClaudeSignature, generateClaudeSignature } = require('../utils/signatureVerification');

describe('Signature Verification Tests', () => {
    const secret = 'test_secret_1234567890123456';
    const testBody = { productId: '123', quantity: 1 };

    describe('Valid Signatures', () => {
        test('Should verify valid signature with simple body', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const isValid = verifyClaudeSignature(signature, testBody, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with nested body', () => {
            const body = {
                user: { id: 1, name: 'John' },
                products: [{ id: 1 }, { id: 2 }]
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with special characters', () => {
            const body = { text: 'Hello!@#$%^&*()_+' };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with empty object', () => {
            const body = {};
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with array payload', () => {
            const body = ['item1', 'item2', 'item3'];
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with null values', () => {
            const body = { field1: 'value', field2: null };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with undefined values', () => {
            const body = { field1: 'value', field2: undefined };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with Unicode characters', () => {
            const body = { text: '中文日本語한국어' };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });

    describe('Invalid Signatures', () => {
        test('Should reject invalid signature', () => {
            const isValid = verifyClaudeSignature('invalid', testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject empty signature', () => {
            const isValid = verifyClaudeSignature('', testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject null signature', () => {
            const isValid = verifyClaudeSignature(null, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject malformed signature (non-hex)', () => {
            const isValid = verifyClaudeSignature('not-a-hex-string', testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject signature with wrong length', () => {
            const shortSig = 'a'.repeat(10);
            const isValid = verifyClaudeSignature(shortSig, testBody, secret);
            expect(isValid).toBe(false);
        });
    });

    describe('Tampered Data', () => {
        test('Should reject tampered body', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const tamperedBody = { ...testBody, quantity: 999 };
            const isValid = verifyClaudeSignature(signature, tamperedBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject body with extra fields', () => {
            const body = { productId: '123' };
            const signature = generateClaudeSignature(body, secret);
            const tampered = { ...body, extra: 'field' };
            const isValid = verifyClaudeSignature(signature, tampered, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject body with missing fields', () => {
            const body = { productId: '123', quantity: 1 };
            const signature = generateClaudeSignature(body, secret);
            const tampered = { productId: '123' };
            const isValid = verifyClaudeSignature(signature, tampered, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject body with changed field order', () => {
            const body1 = { a: 1, b: 2 };
            const body2 = { b: 2, a: 1 };
            const signature = generateClaudeSignature(body1, secret);
            const isValid = verifyClaudeSignature(signature, body2, secret);
            expect(isValid).toBe(false);
        });
    });

    describe('Edge Cases - Empty/Null/Undefined', () => {
        test('Should handle empty body', () => {
            const signature = generateClaudeSignature({}, secret);
            const isValid = verifyClaudeSignature(signature, {}, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle null body', () => {
            const isValid = verifyClaudeSignature('sig', null, secret);
            expect(isValid).toBe(false);
        });

        test('Should handle undefined body', () => {
            const isValid = verifyClaudeSignature('sig', undefined, secret);
            expect(isValid).toBe(false);
        });

        test('Should handle empty secret', () => {
            const isValid = verifyClaudeSignature('sig', testBody, '');
            expect(isValid).toBe(false);
        });

        test('Should handle null secret', () => {
            const isValid = verifyClaudeSignature('sig', testBody, null);
            expect(isValid).toBe(false);
        });

        test('Should handle undefined secret', () => {
            const isValid = verifyClaudeSignature('sig', testBody, undefined);
            expect(isValid).toBe(false);
        });

        test('Should handle missing signature header', () => {
            const isValid = verifyClaudeSignature(undefined, testBody, secret);
            expect(isValid).toBe(false);
        });
    });

    describe('Large Payloads', () => {
        test('Should handle large payload (1MB)', () => {
            const largeBody = { data: 'x'.repeat(1024 * 1024) };
            const signature = generateClaudeSignature(largeBody, secret);
            const isValid = verifyClaudeSignature(signature, largeBody, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle large payload (5MB)', () => {
            const largeBody = { data: 'x'.repeat(1024 * 1024 * 5) };
            const signature = generateClaudeSignature(largeBody, secret);
            const isValid = verifyClaudeSignature(signature, largeBody, secret);
            expect(isValid).toBe(true);
        });
    });

    describe('Security Tests', () => {
        test('Should be resistant to timing attacks', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const invalidSignature = 'a'.repeat(signature.length);
            
            const start1 = Date.now();
            verifyClaudeSignature(signature, testBody, secret);
            const time1 = Date.now() - start1;
            
            const start2 = Date.now();
            verifyClaudeSignature(invalidSignature, testBody, secret);
            const time2 = Date.now() - start2;
            
            expect(Math.abs(time1 - time2)).toBeLessThan(100);
        });

        test('Should reject replay attack with different timestamp', () => {
            const body = { productId: '123', timestamp: 1234567890 };
            const signature = generateClaudeSignature(body, secret);
            const replayed = { ...body, timestamp: 1234567891 };
            const isValid = verifyClaudeSignature(signature, replayed, secret);
            expect(isValid).toBe(false);
        });

        test('Should handle special characters in secret', () => {
            const specialSecret = 'secret!@#$%^&*()_+-=';
            const signature = generateClaudeSignature(testBody, specialSecret);
            const isValid = verifyClaudeSignature(signature, testBody, specialSecret);
            expect(isValid).toBe(true);
        });

        test('Should reject signature with malformed format', () => {
            const malformed = 'g'.repeat(64);
            const isValid = verifyClaudeSignature(malformed, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject hex-like but incorrect signature', () => {
            const hexLike = 'a'.repeat(64);
            const isValid = verifyClaudeSignature(hexLike, testBody, secret);
            expect(isValid).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('Should handle invalid secret type (number)', () => {
            expect(() => {
                verifyClaudeSignature('sig', testBody, 123);
            }).toThrow();
        });

        test('Should handle invalid secret type (boolean)', () => {
            expect(() => {
                verifyClaudeSignature('sig', testBody, true);
            }).toThrow();
        });

        test('Should handle invalid body type (number)', () => {
            expect(() => {
                verifyClaudeSignature('sig', 123, secret);
            }).toThrow();
        });

        test('Should handle invalid body type (boolean)', () => {
            expect(() => {
                verifyClaudeSignature('sig', true, secret);
            }).toThrow();
        });

        test('Should handle invalid body type (string)', () => {
            expect(() => {
                verifyClaudeSignature('sig', 'string', secret);
            }).toThrow();
        });

        test('Should handle invalid signature type (number)', () => {
            expect(() => {
                verifyClaudeSignature(123, testBody, secret);
            }).toThrow();
        });

        test('Should handle invalid signature type (boolean)', () => {
            expect(() => {
                verifyClaudeSignature(true, testBody, secret);
            }).toThrow();
        });
    });

    describe('Performance Tests', () => {
        test('Should verify signature within 50ms for average payload', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const start = Date.now();
            verifyClaudeSignature(signature, testBody, secret);
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
        });

        test('Should handle 100 concurrent verifications', async () => {
            const signature = generateClaudeSignature(testBody, secret);
            const promises = Array(100).fill().map(() => 
                Promise.resolve(verifyClaudeSignature(signature, testBody, secret))
            );
            const results = await Promise.all(promises);
            expect(results.every(r => r === true)).toBe(true);
        });
    });

    describe('Integration Tests', () => {
        test('Should work with request object', () => {
            const req = {
                body: { productId: '123', quantity: 1 },
                headers: {}
            };
            const signature = generateClaudeSignature(req.body, secret);
            req.headers['x-signature'] = signature;
            const isValid = verifyClaudeSignature(
                req.headers['x-signature'],
                req.body,
                secret
            );
            expect(isValid).toBe(true);
        });

        test('Should reject request with missing signature header', () => {
            const req = {
                body: { productId: '123' },
                headers: {}
            };
            const isValid = verifyClaudeSignature(
                req.headers['x-signature'],
                req.body,
                secret
            );
            expect(isValid).toBe(false);
        });

        test('Should reject request with invalid signature header', () => {
            const req = {
                body: { productId: '123' },
                headers: { 'x-signature': 'invalid-signature' }
            };
            const isValid = verifyClaudeSignature(
                req.headers['x-signature'],
                req.body,
                secret
            );
            expect(isValid).toBe(false);
        });
    });

    describe('Cross-Platform Compatibility', () => {
        test('Should handle different JSON stringify order consistently', () => {
            const body1 = { a: 1, b: 2, c: 3 };
            const body2 = { c: 3, b: 2, a: 1 };
            const signature = generateClaudeSignature(body1, secret);
            const isValid = verifyClaudeSignature(signature, body2, secret);
            expect(isValid).toBe(false);
        });

        test('Should handle deep nested objects', () => {
            const body = {
                level1: {
                    level2: {
                        level3: {
                            level4: 'deep'
                        }
                    }
                }
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });
});