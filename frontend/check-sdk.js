const sdk = require('casper-js-sdk');

// Test correct CLValue construction with CLValue factory methods
console.log("=== Testing CLValue.newCLUInt256 ===");

try {
    // Create CLValues using factory methods
    const commitmentVal = sdk.CLValue.newCLUInt256("12345678901234567890");
    const amountVal = sdk.CLValue.newCLUInt512("100000000000");

    console.log("commitment CLValue:", commitmentVal);
    console.log("commitment has getType?", typeof commitmentVal.getType);
    console.log("commitment getType():", commitmentVal.getType ? commitmentVal.getType() : "N/A");

    // Create args using correct CLValues
    const args = sdk.Args.fromMap({
        commitment: commitmentVal,
        amount: amountVal,
    });

    console.log("\nArgs created successfully:", args);

    // Now try building a transaction
    const senderKey = sdk.PublicKey.fromHex("0203df00d558636bfce196b83c8a518f483492eb0f07a2478d60f07d6c6a820183f5");
    const contractHash = "5ebf4ad5f80e5b5613df0506d13d95225150487ac4434cf2c0ffba22d743fa14";

    const transaction = new sdk.ContractCallBuilder()
        .from(senderKey)
        .byHash(contractHash)
        .entryPoint("deposit")
        .runtimeArgs(args)
        .payment(5000000000)
        .chainName("casper-test")
        .ttl(1800000)
        .build();

    console.log("\n=== Transaction created successfully! ===");
    console.log("Transaction type:", typeof transaction);

    // Convert to JSON
    const json = sdk.TransactionV1.toJSON(transaction);
    console.log("\nTransaction JSON (first 800 chars):", JSON.stringify(json, null, 2).substring(0, 800));

} catch (e) {
    console.error("Error:", e.message);
    console.error("Stack:", e.stack);
}
