module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  testEnvironment: '<rootDir>/test/custom-environment.ts',
};
