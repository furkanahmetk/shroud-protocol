/**
 * Compact binary encoding for Groth16 proofs on BN254.
 *
 * Maps snarkjs's verbose JSON proof object (~4 KB) to a fixed 256-byte layout
 * that the on-chain verifier can parse without string handling.
 *
 * Layout (each 32-byte segment is a Fq element, big-endian):
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
    return new Uint8Array(Buffer.from(hex, 'hex'));
}

export function snarkjsProofToBytes(proof: SnarkjsProof): Uint8Array {
    const parts = [
        fqDecimalToBE32(proof.pi_a[0]),
        fqDecimalToBE32(proof.pi_a[1]),
        fqDecimalToBE32(proof.pi_b[0][0]),
        fqDecimalToBE32(proof.pi_b[0][1]),
        fqDecimalToBE32(proof.pi_b[1][0]),
        fqDecimalToBE32(proof.pi_b[1][1]),
        fqDecimalToBE32(proof.pi_c[0]),
        fqDecimalToBE32(proof.pi_c[1]),
    ];
    const out = Buffer.concat(parts.map(p => Buffer.from(p)));
    if (out.length !== PROOF_BYTES_LEN) {
        throw new Error(`encoded proof length is ${out.length}, expected ${PROOF_BYTES_LEN}`);
    }
    return new Uint8Array(out);
}
