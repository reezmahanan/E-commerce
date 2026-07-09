module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        '**/*.js',
        '!node_modules/**'
    ],
    testMatch: [
        '**/tests/**/*.test.js'
    ]
};
