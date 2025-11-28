pragma circom 2.1.0;

// MiMC-7 hash function with 91 rounds
template MiMC7(nInputs) {
    signal input ins[nInputs];
    signal input k;
    signal output out;

    // Constants for MiMC-7 (simplified for example, normally these are random constants)
    var c[91] = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0
    ];

    signal t[nInputs][92];
    
    for (var i=0; i<nInputs; i++) {
        t[i][0] <== k;
        for (var j=0; j<91; j++) {
            var t2 = (t[i][j] + ins[i] + c[j]) ** 7;
            t[i][j+1] <== t2;
        }
    }
    
    out <== t[nInputs-1][91];
}

template MiMCSponge(nInputs, nOutputs) {
    signal input ins[nInputs];
    signal input k;
    signal output outs[nOutputs];

    component mimc = MiMC7(nInputs);
    mimc.k <== k;
    for (var i=0; i<nInputs; i++) {
        mimc.ins[i] <== ins[i];
    }
    
    outs[0] <== mimc.out;
    for (var i=1; i<nOutputs; i++) {
        outs[i] <== 0;
    }
}
