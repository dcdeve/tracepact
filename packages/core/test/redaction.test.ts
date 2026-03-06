import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RedactionPipeline } from '../src/redaction/pipeline.js';

describe('RedactionPipeline', () => {
  it('redacts Anthropic API keys', () => {
    const pipeline = new RedactionPipeline();
    const input = 'Bearer sk-abcdefghij1234567890abcdefghij';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_API_KEY]');
    expect(result).not.toContain('sk-abcdefghij');
  });

  it('redacts GitHub tokens', () => {
    const pipeline = new RedactionPipeline();
    const input = 'token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_GH_TOKEN]');
    expect(result).not.toContain('ghp_');
  });

  it('redacts PEM private keys', () => {
    const pipeline = new RedactionPipeline();
    const input =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_PRIVATE_KEY]');
    expect(result).not.toContain('BEGIN RSA PRIVATE KEY');
  });

  it('redacts Slack tokens', () => {
    const pipeline = new RedactionPipeline();
    const input = 'slack: xoxb-123-456-abc';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_SLACK_TOKEN]');
    expect(result).not.toContain('xoxb-');
  });

  it('redacts AWS access keys', () => {
    const pipeline = new RedactionPipeline();
    const input = 'aws_key=AKIAIOSFODNN7EXAMPLE';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_AWS_KEY]');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('leaves strings without secrets unchanged', () => {
    const pipeline = new RedactionPipeline();
    const input = 'Hello world, nothing secret here.';

    expect(pipeline.redact(input)).toBe(input);
  });

  it('redacts multiple different secrets in one string', () => {
    const pipeline = new RedactionPipeline();
    const input = 'key=sk-abcdefghij1234567890abcdefghij token=AKIAIOSFODNN7EXAMPLE';
    const result = pipeline.redact(input);

    expect(result).toContain('[REDACTED_API_KEY]');
    expect(result).toContain('[REDACTED_AWS_KEY]');
    expect(result).not.toContain('sk-abcdefghij');
    expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('applies user-defined custom rules', () => {
    const pipeline = new RedactionPipeline({
      rules: [{ pattern: /internal\.corp\.com/g, replacement: '[REDACTED_INTERNAL]' }],
    });

    const result = pipeline.redact('connect to internal.corp.com:8080');
    expect(result).toContain('[REDACTED_INTERNAL]');
    expect(result).not.toContain('internal.corp.com');
  });

  describe('redactEnvValues', () => {
    const ENV_KEY = 'TEST_SECRET_VALUE';

    beforeEach(() => {
      process.env[ENV_KEY] = 'hunter2';
    });

    afterEach(() => {
      delete process.env[ENV_KEY];
    });

    it('redacts environment variable values', () => {
      const pipeline = new RedactionPipeline({
        redactEnvValues: [ENV_KEY],
      });

      const result = pipeline.redact('password is hunter2');
      expect(result).toContain(`[REDACTED_ENV:${ENV_KEY}]`);
      expect(result).not.toContain('hunter2');
    });
  });

  it('deep-redacts objects via redactObject', () => {
    const pipeline = new RedactionPipeline();
    const obj = {
      key: 'sk-abcdefghij1234567890abcdefghij',
      nested: {
        aws: 'AKIAIOSFODNN7EXAMPLE',
        safe: 'hello',
      },
    };

    const result = pipeline.redactObject(obj);
    expect(result.key).toContain('[REDACTED_API_KEY]');
    expect(result.nested.aws).toContain('[REDACTED_AWS_KEY]');
    expect(result.nested.safe).toBe('hello');
  });

  it('handles empty string input', () => {
    const pipeline = new RedactionPipeline();
    expect(pipeline.redact('')).toBe('');
  });

  it('handles regex special chars in env values', () => {
    const ENV_KEY = 'TEST_DB_URL';
    process.env[ENV_KEY] = 'postgres://user:p@ss@host/db?ssl=1';

    const pipeline = new RedactionPipeline({
      redactEnvValues: [ENV_KEY],
    });

    const result = pipeline.redact('connecting to postgres://user:p@ss@host/db?ssl=1');
    expect(result).toContain(`[REDACTED_ENV:${ENV_KEY}]`);
    expect(result).not.toContain('postgres://user');

    delete process.env[ENV_KEY];
  });

  it('ignores env values that are not set', () => {
    const pipeline = new RedactionPipeline({
      redactEnvValues: ['NONEXISTENT_VAR_12345'],
    });

    const input = 'nothing to redact';
    expect(pipeline.redact(input)).toBe(input);
  });
});
