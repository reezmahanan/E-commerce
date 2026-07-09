const { verifyClaudeSignature, generateClaudeSignature } = require('../utils/signatureVerification');

describe('Signature Verification Tests', () => {
    const secret = 'test_secret_1234567890123456';
    const testBody = { productId: '123', quantity: 1 };

    // ============================================
    // VALID SIGNATURES - POSITIVE TESTS
    // ============================================
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

        test('Should verify valid signature with emojis', () => {
            const body = { text: 'Hello World' };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with date objects', () => {
            const body = { date: new Date('2024-01-01') };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should verify valid signature with mixed types', () => {
            const body = {
                id: 123,
                name: 'Product',
                price: 99.99,
                inStock: true,
                tags: ['new', 'featured'],
                metadata: { views: 1000 }
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });

    // ============================================
    // INVALID SIGNATURES - NEGATIVE TESTS
    // ============================================
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

        test('Should reject signature with extra characters', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const invalidSig = signature + 'extra';
            const isValid = verifyClaudeSignature(invalidSig, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject signature with missing characters', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const invalidSig = signature.slice(0, -5);
            const isValid = verifyClaudeSignature(invalidSig, testBody, secret);
            expect(isValid).toBe(false);
        });
    });

    // ============================================
    // TAMPERED DATA TESTS
    // ============================================
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

        test('Should reject body with changed field values', () => {
            const body = { productId: '123', price: 100 };
            const signature = generateClaudeSignature(body, secret);
            const tampered = { productId: '123', price: 999 };
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

        test('Should reject tampered nested objects', () => {
            const body = {
                user: { id: 1, name: 'John' },
                products: [{ id: 1, qty: 1 }]
            };
            const signature = generateClaudeSignature(body, secret);
            const tampered = {
                user: { id: 1, name: 'Jane' },
                products: [{ id: 1, qty: 1 }]
            };
            const isValid = verifyClaudeSignature(signature, tampered, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject tampered array', () => {
            const body = { items: ['a', 'b', 'c'] };
            const signature = generateClaudeSignature(body, secret);
            const tampered = { items: ['a', 'b', 'd'] };
            const isValid = verifyClaudeSignature(signature, tampered, secret);
            expect(isValid).toBe(false);
        });
    });

    // ============================================
    // EDGE CASES - EMPTY, NULL, UNDEFINED
    // ============================================
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
            const signature = generateClaudeSignature(testBody, '');
            const isValid = verifyClaudeSignature(signature, testBody, '');
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

        test('Should handle empty string body', () => {
            const signature = generateClaudeSignature('', secret);
            const isValid = verifyClaudeSignature(signature, '', secret);
            expect(isValid).toBe(true);
        });

        test('Should handle null values in body', () => {
            const body = { a: null, b: 'test', c: null };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });

    // ============================================
    // LARGE PAYLOAD TESTS
    // ============================================
    describe('Large Payloads', () => {
        test('Should handle large payload 100KB', () => {
            const largeBody = { data: 'x'.repeat(100 * 1024) };
            const signature = generateClaudeSignature(largeBody, secret);
            const isValid = verifyClaudeSignature(signature, largeBody, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle large payload 1MB', () => {
            const largeBody = { data: 'x'.repeat(1024 * 1024) };
            const signature = generateClaudeSignature(largeBody, secret);
            const isValid = verifyClaudeSignature(signature, largeBody, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle large payload 5MB', () => {
            const largeBody = { data: 'x'.repeat(1024 * 1024 * 5) };
            const signature = generateClaudeSignature(largeBody, secret);
            const isValid = verifyClaudeSignature(signature, largeBody, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle large array payload', () => {
            const largeArray = Array(10000).fill('item');
            const signature = generateClaudeSignature(largeArray, secret);
            const isValid = verifyClaudeSignature(signature, largeArray, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle large nested payload', () => {
            const largeNested = {
                data: Array(1000).fill({
                    id: Math.random(),
                    name: 'Item',
                    nested: { value: 'deep' }
                })
            };
            const signature = generateClaudeSignature(largeNested, secret);
            const isValid = verifyClaudeSignature(signature, largeNested, secret);
            expect(isValid).toBe(true);
        });
    });

    // ============================================
    // SECURITY TESTS
    // ============================================
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

        test('Should reject signature with null bytes', () => {
            const maliciousSig = '\x00'.repeat(32) + 'a'.repeat(32);
            const isValid = verifyClaudeSignature(maliciousSig, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject signature with newline characters', () => {
            const maliciousSig = 'a'.repeat(32) + '\n' + 'b'.repeat(31);
            const isValid = verifyClaudeSignature(maliciousSig, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject SQL injection attempt in signature', () => {
            const sqlSig = "' OR '1'='1";
            const isValid = verifyClaudeSignature(sqlSig, testBody, secret);
            expect(isValid).toBe(false);
        });

        test('Should reject XSS attempt in signature', () => {
            const xssSig = '<script>alert("xss")</script>';
            const isValid = verifyClaudeSignature(xssSig, testBody, secret);
            expect(isValid).toBe(false);
        });
    });

    // ============================================
    // ERROR HANDLING TESTS
    // ============================================
    describe('Error Handling', () => {
        test('Should handle invalid secret type number', () => {
            expect(() => {
                verifyClaudeSignature('sig', testBody, 123);
            }).toThrow();
        });

        test('Should handle invalid secret type boolean', () => {
            expect(() => {
                verifyClaudeSignature('sig', testBody, true);
            }).toThrow();
        });

        test('Should handle invalid secret type object', () => {
            expect(() => {
                verifyClaudeSignature('sig', testBody, {});
            }).toThrow();
        });

        test('Should handle invalid body type number', () => {
            expect(() => {
                verifyClaudeSignature('sig', 123, secret);
            }).toThrow();
        });

        test('Should handle invalid body type boolean', () => {
            expect(() => {
                verifyClaudeSignature('sig', true, secret);
            }).toThrow();
        });

        test('Should handle invalid body type string', () => {
            expect(() => {
                verifyClaudeSignature('sig', 'string', secret);
            }).toThrow();
        });

        test('Should handle invalid signature type number', () => {
            expect(() => {
                verifyClaudeSignature(123, testBody, secret);
            }).toThrow();
        });

        test('Should handle invalid signature type boolean', () => {
            expect(() => {
                verifyClaudeSignature(true, testBody, secret);
            }).toThrow();
        });

        test('Should handle invalid signature type object', () => {
            expect(() => {
                verifyClaudeSignature({}, testBody, secret);
            }).toThrow();
        });

        test('Should handle invalid signature type array', () => {
            expect(() => {
                verifyClaudeSignature([], testBody, secret);
            }).toThrow();
        });
    });

    // ============================================
    // PERFORMANCE TESTS
    // ============================================
    describe('Performance Tests', () => {
        test('Should verify signature within 50ms for average payload', () => {
            const signature = generateClaudeSignature(testBody, secret);
            const start = Date.now();
            verifyClaudeSignature(signature, testBody, secret);
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(50);
        });

        test('Should generate signature within 50ms for average payload', () => {
            const start = Date.now();
            generateClaudeSignature(testBody, secret);
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

        test('Should handle 1000 concurrent verifications', async () => {
            const signature = generateClaudeSignature(testBody, secret);
            const promises = Array(1000).fill().map(() =>
                Promise.resolve(verifyClaudeSignature(signature, testBody, secret))
            );
            const results = await Promise.all(promises);
            expect(results.every(r => r === true)).toBe(true);
        });

        test('Should perform consistently over multiple iterations', () => {
            const iterations = 100;
            const times = [];

            for (let i = 0; i < iterations; i++) {
                const signature = generateClaudeSignature(testBody, secret);
                const start = Date.now();
                verifyClaudeSignature(signature, testBody, secret);
                times.push(Date.now() - start);
            }

            const average = times.reduce((a, b) => a + b, 0) / times.length;
            expect(average).toBeLessThan(10);
        });

        test('Should handle large payload verification within 200ms', () => {
            const largeBody = { data: 'x'.repeat(1024 * 1024) };
            const signature = generateClaudeSignature(largeBody, secret);
            const start = Date.now();
            verifyClaudeSignature(signature, largeBody, secret);
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(200);
        });
    });

    // ============================================
    // INTEGRATION TESTS WITH MOCK REQUEST
    // ============================================
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

        test('Should work with Express style request', () => {
            const req = {
                method: 'POST',
                url: '/api/order',
                body: { orderId: 'ORD-123', amount: 100 },
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

        test('Should handle request with different header name', () => {
            const req = {
                body: { productId: '123' },
                headers: {}
            };
            const signature = generateClaudeSignature(req.body, secret);
            req.headers['x-claude-signature'] = signature;

            const isValid = verifyClaudeSignature(
                req.headers['x-claude-signature'],
                req.body,
                secret
            );
            expect(isValid).toBe(true);
        });

        test('Should handle request with multiple headers', () => {
            const req = {
                body: { productId: '123' },
                headers: {
                    'content-type': 'application/json',
                    'x-signature': 'some-value',
                    'user-agent': 'test'
                }
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
    });

    // ============================================
    // CROSS-PLATFORM COMPATIBILITY TESTS
    // ============================================
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

        test('Should handle deeply nested arrays', () => {
            const body = {
                data: [[[['deep']]]]
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle mixed nested structures', () => {
            const body = {
                users: [
                    { id: 1, profile: { name: 'John', tags: ['admin', 'verified'] } },
                    { id: 2, profile: { name: 'Jane', tags: ['user'] } }
                ],
                metadata: { total: 2, page: 1 }
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle Unicode characters in all fields', () => {
            const body = {
                chinese: '中文',
                japanese: '日本語',
                korean: '한국어',
                mix: 'Hello World'
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle special characters and whitespace', () => {
            const body = {
                text: '  Hello  \t\n\r  ',
                special: '!@#$%^&*()_+-=[]{}|;:,.<>?/`~'
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle numbers as strings and numbers', () => {
            const body = {
                stringNumber: '123',
                actualNumber: 123,
                float: 123.45,
                scientific: 1.23e-4
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle boolean values', () => {
            const body = {
                trueValue: true,
                falseValue: false,
                truthy: 'true',
                falsy: 'false'
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle null and undefined in nested structures', () => {
            const body = {
                a: null,
                b: undefined,
                c: {
                    d: null,
                    e: undefined,
                    f: { g: null }
                },
                arr: [null, undefined, 1, 'test']
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });

    // ============================================
    // ADDITIONAL EDGE CASES
    // ============================================
    describe('Additional Edge Cases', () => {
        test('Should handle Buffer data', () => {
            const body = { data: Buffer.from('test') };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle RegExp objects', () => {
            const body = { pattern: /test/gi };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle Date objects in body', () => {
            const body = {
                createdAt: new Date('2024-01-01T00:00:00Z'),
                updatedAt: new Date()
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle Map objects', () => {
            const body = { map: new Map([['key', 'value']]) };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle Set objects', () => {
            const body = { set: new Set([1, 2, 3]) };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle extremely long strings in body', () => {
            const longString = 'a'.repeat(100000);
            const body = { data: longString };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });

        test('Should handle base64 encoded data', () => {
            const body = {
                image: Buffer.from('test image data').toString('base64'),
                type: 'image/jpeg'
            };
            const signature = generateClaudeSignature(body, secret);
            const isValid = verifyClaudeSignature(signature, body, secret);
            expect(isValid).toBe(true);
        });
    });
});