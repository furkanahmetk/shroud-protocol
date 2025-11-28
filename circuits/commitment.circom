pragma circom 2.1.0;

include "mimc.circom";

template Commitment() {
    signal input nullifier;
    signal input secret;
    signal output commitment;

    component hasher = MiMCSponge(2, 1);
    hasher.ins[0] <== nullifier;
    hasher.ins[1] <== secret;
    hasher.k <== 0;

    commitment <== hasher.outs[0];
}
