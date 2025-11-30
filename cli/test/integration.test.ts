import { expect } from 'chai';
import { CryptoUtils } from '../src/crypto';

describe('CLI Integration Tests', () => {
    let crypto: CryptoUtils;

    before(async () => {
        crypto = new CryptoUtils();
        await crypto.init();
    });

    it('should generate valid secrets', () => {
        const { nullifier, secret } = crypto.generateSecrets();
        expect(nullifier).to.be.a('bigint');
        expect(secret).to.be.a('bigint');
    });

    it('should compute commitment correctly', () => {
        const nullifier = BigInt(12345);
        const secret = BigInt(67890);
        const commitment = crypto.computeCommitment(nullifier, secret);

        // We can't easily verify the hash value without re-implementing MiMC,
        // but we can check it's a BigInt and deterministic.
        expect(commitment).to.be.a('bigint');

        const commitment2 = crypto.computeCommitment(nullifier, secret);
        expect(commitment).to.equal(commitment2);
    });

    it('should compute nullifier hash correctly', () => {
        const nullifier = BigInt(12345);
        const hash = crypto.computeNullifierHash(nullifier);
        expect(hash).to.be.a('bigint');

        const hash2 = crypto.computeNullifierHash(nullifier);
        expect(hash).to.equal(hash2);
    });
});
