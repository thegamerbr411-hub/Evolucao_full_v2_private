export class DomainError extends Error {
  constructor(code, message, meta = {}) {
    super(message || code);
    this.name = 'DomainError';
    this.code = code;
    this.meta = meta;
  }
}
