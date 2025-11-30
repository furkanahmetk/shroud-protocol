pragma circom 2.1.0;

include "mimc.circom";

template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output root;

    component hashers[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        hashers[i] = MultiMiMC7(2, 91);
        hashers[i].k <== 0;

        // If pathIndices[i] == 0, leaf is on left
        // If pathIndices[i] == 1, leaf is on right
        // hash(left, right)
        // left = pathIndices[i] == 0 ? hashes[i] : pathElements[i]
        // right = pathIndices[i] == 0 ? pathElements[i] : hashes[i]
        
        // Using quadratic constraints to enforce selection
        // left = hashes[i] - pathIndices[i] * (hashes[i] - pathElements[i])
        // right = pathElements[i] - pathIndices[i] * (pathElements[i] - hashes[i])

        hashers[i].in[0] <== hashes[i] - pathIndices[i] * (hashes[i] - pathElements[i]);
        hashers[i].in[1] <== pathElements[i] - pathIndices[i] * (pathElements[i] - hashes[i]);

        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[levels];
}
