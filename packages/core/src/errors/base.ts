export class TracepactError extends Error {
  readonly code: string;
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TracepactError';
    this.code = code;
  }
}
