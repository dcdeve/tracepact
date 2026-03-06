import { TracepactError } from './base.js';

export class DriverError extends TracepactError {
  constructor(message: string) {
    super('DRIVER_ERROR', message);
    this.name = 'DriverError';
  }
}
