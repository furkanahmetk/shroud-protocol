const sdk = require('casper-js-sdk');

// Check Transaction setSignature signature
console.log("=== Transaction ===");
console.log(Object.getOwnPropertyNames(sdk.Transaction.prototype || {}));

// Check if it's a mutating method (modifies in place)
console.log("\n=== Transaction.setSignature ===");
if (sdk.Transaction.prototype.setSignature) {
    console.log(sdk.Transaction.prototype.setSignature.toString().substring(0, 500));
}

// Check sign method
console.log("\n=== Transaction.sign ===");
if (sdk.Transaction.prototype.sign) {
    console.log(sdk.Transaction.prototype.sign.toString().substring(0, 500));
}
