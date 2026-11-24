import { apiEndpoint, resolveStage } from '../src/stage';

describe('resolveStage', () => {
  test('that an unset or blank STAGE is local', () => {
    expect(resolveStage({})).toBe('local');
    expect(resolveStage({ STAGE: ' ' })).toBe('local');
  });

  test.each(['development', 'production'])('that STAGE=%s is accepted', (stage) => {
    expect(resolveStage({ STAGE: stage })).toBe(stage);
  });

  test('that an unknown STAGE fails', () => {
    expect(() => resolveStage({ STAGE: 'prod' })).toThrow('Unknown STAGE "prod"');
  });
});

describe('apiEndpoint', () => {
  test('that production uses the production API', () => {
    expect(apiEndpoint('production')).toBe('https://api.kenilworthford.com');
  });

  test.each(['local', 'development'] as const)('that %s uses the development API', (stage) => {
    expect(apiEndpoint(stage)).toBe('https://api.dev.kenilworthford.com');
  });
});
