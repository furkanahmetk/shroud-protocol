pragma circom 2.1.0;

include "mimc.circom";

template Commitment() {
    signal input nullifier;
    signal input secret;
    signal output commitment;

    component hasher = MultiMiMC7(2, 91);
    hasher.in[0] <== nullifier;
    hasher.in[1] <== secret;
    hasher.k <== 0;

    commitment <== hasher.out;
}
