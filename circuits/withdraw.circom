pragma circom 2.1.0;

include "merkleTree.circom";
include "commitment.circom";
include "mimc.circom";

template Withdraw(levels) {
    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;

    // Compute commitment
    component commitmentHasher = Commitment();
    commitmentHasher.nullifier <== nullifier;
    commitmentHasher.secret <== secret;

    // Verify Merkle proof
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitmentHasher.commitment;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }
    tree.root === root;

    // Compute nullifier hash
    component nullifierHasher = MiMCSponge(1, 1);
    nullifierHasher.ins[0] <== nullifier;
    nullifierHasher.k <== 0;
    nullifierHasher.outs[0] === nullifierHash;

    // Add hidden signals to prevent tampering with recipient, relayer, fee
    // We square them to ensure they are included in the constraints
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
    
    signal relayerSquare;
    relayerSquare <== relayer * relayer;

    signal feeSquare;
    feeSquare <== fee * fee;
}

component main {public [root, nullifierHash, recipient, relayer, fee]} = Withdraw(20);
