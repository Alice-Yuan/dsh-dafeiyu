export class DomainError extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
        this.name = 'DomainError';
    }
}
export function assertText(value, limit = 256) {
    if (typeof value !== 'string' || value.length < 1 || value.length > limit || value.includes('\0')) {
        throw new DomainError('INVALID_INPUT');
    }
}
export function assertId(value) {
    assertText(value, 120);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value))
        throw new DomainError('INVALID_ID');
}
//# sourceMappingURL=contracts.js.map