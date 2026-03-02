const { Keys, CasperServiceByJsonRPC, CLPublicKey } = require('casper-js-sdk');

async function main() {
    try {
        const keyPath = '/Users/mertk/Downloads/Account 9_secret_key.pem';
        const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(keyPath);
        console.log('Public Key Hex: ' + keyPair.publicKey.toHex());
        console.log('Account Hash: ' + keyPair.publicKey.toAccountHashStr());

        const client = new CasperServiceByJsonRPC('https://node.testnet.casper.network/rpc');

        const stateRoot = await client.getStateRootHash();
        console.log('State root: ' + stateRoot);

        try {
            const balanceUref = await client.getAccountBalanceUrefByPublicKey(stateRoot, keyPair.publicKey);
            if (!balanceUref) {
                console.log('Account is uninitialized or not found in state.');
                return;
            }
            const balance = await client.getAccountBalance(stateRoot, balanceUref);
            console.log('Balance: ' + (parseInt(balance.toString()) / 1000000000) + ' CSPR');
        } catch (e) {
            console.log('Error getting balance: ' + e.message);
        }
    } catch (e) {
        console.log('Fatal error: ' + e);
        console.log(e.stack);
    }
}
main();
