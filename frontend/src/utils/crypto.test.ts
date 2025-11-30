import { CryptoUtils } from './crypto';

// Mock window.crypto
const mockCrypto = {
    getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    }
};

// @ts-ignore
global.window = { crypto: mockCrypto };


describe('CryptoUtils', () => {
    let crypto: CryptoUtils;

    beforeAll(async () => {
        crypto = new CryptoUtils();
        await crypto.init();
    });

    it('should generate secrets', () => {
        const { nullifier, secret } = crypto.generateSecrets();
        expect(typeof nullifier).toBe('bigint');
        expect(typeof secret).toBe('bigint');
    });

    it('should compute commitment', () => {
        const nullifier = BigInt(12345);
        const secret = BigInt(67890);
        const commitment = crypto.computeCommitment(nullifier, secret);
        expect(typeof commitment).toBe('bigint');
    });
});
