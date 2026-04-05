import { DomainError } from '../errors/DomainError.js';

export function assert(condition, code, message) {
  if (!condition) {
    throw new DomainError(code, message);
  }
}
