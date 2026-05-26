/**
 * Compact 256-byte binary encoding for Groth16 proofs on BN254.
 * Mirrors `cli/src/proof_codec.ts` and `contracts/src/verifier.rs::parse_binary_proof`.
 *
 * Byte layout (each segment is a Fq element, big-endian):
 *   [  0..32 ] = A.x
 *   [ 32..64 ] = A.y
 *   [ 64..96 ] = B.x.c0
 *   [ 96..128] = B.x.c1
 *   [128..160] = B.y.c0
 *   [160..192] = B.y.c1
 *   [192..224] = C.x
 *   [224..256] = C.y
 */

export const PROOF_BYTES_LEN = 256;

export interface SnarkjsProof {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol?: string;
    curve?: string;
}

function fqDecimalToBE32(dec: string): Uint8Array {
    let hex = BigInt(dec).toString(16);
    if (hex.length > 64) {
        throw new Error(`field element overflow: ${dec}`);
    }
    hex = hex.padStart(64, '0');
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        out[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return out;
}

export function snarkjsProofToBytes(proof: SnarkjsProof): Uint8Array {
    const segments = [
        fqDecimalToBE32(proof.pi_a[0]),
        fqDecimalToBE32(proof.pi_a[1]),
        fqDecimalToBE32(proof.pi_b[0][0]),
        fqDecimalToBE32(proof.pi_b[0][1]),
        fqDecimalToBE32(proof.pi_b[1][0]),
        fqDecimalToBE32(proof.pi_b[1][1]),
        fqDecimalToBE32(proof.pi_c[0]),
        fqDecimalToBE32(proof.pi_c[1]),
    ];
    const out = new Uint8Array(PROOF_BYTES_LEN);
    segments.forEach((seg, i) => out.set(seg, i * 32));
    return out;
}
