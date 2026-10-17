import { DomainError } from '../core/contracts.js';
// Fail closed. No code path substitutes fake responses for a production request.
export const productionModel = {
    mode: 'production',
    async decide() { throw new DomainError('DSH_MODEL_NOT_INTEGRATED'); },
    async compose() { throw new DomainError('DSH_MODEL_NOT_INTEGRATED'); },
};
export const productionOwner = {
    mode: 'production',
    async deliver() { throw new DomainError('DSH_OWNER_DELIVERY_NOT_INTEGRATED'); },
};
//# sourceMappingURL=production.js.map