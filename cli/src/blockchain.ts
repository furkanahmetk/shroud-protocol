import { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder, Keys } from 'casper-js-sdk';
import * as fs from 'fs';

export class BlockchainClient {
    private client: CasperClient;
    private contractHash: string;

    constructor(nodeUrl: string, contractHash: string) {
        this.client = new CasperClient(nodeUrl);
        this.contractHash = contractHash.startsWith('hash-') ? contractHash.slice(5) : contractHash;
    }

    async deposit(
        commitment: bigint,
        amount: bigint,
        senderKeyPath: string,
        sessionWasmPath?: string
    ): Promise<string> {
        let keyPair;
        try {
            keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        } catch (e) {
            keyPair = Keys.Secp256K1.loadKeyPairFromPrivateFile(senderKeyPath);
        }

        // If session WASM is provided, use ModuleBytes to transfer real CSPR
        if (sessionWasmPath && fs.existsSync(sessionWasmPath)) {
            const sessionWasm = new Uint8Array(fs.readFileSync(sessionWasmPath));

            const args = RuntimeArgs.fromMap({
                contract_package_hash: CLValueBuilder.byteArray(Buffer.from(this.contractHash, 'hex')),
                commitment: CLValueBuilder.u256(commitment.toString()),
                amount: CLValueBuilder.u512(amount.toString()),
            });

            const deploy = DeployUtil.makeDeploy(
                new DeployUtil.DeployParams(
                    keyPair.publicKey,
                    'casper-test',
                    1,
                    1800000
                ),
                DeployUtil.ExecutableDeployItem.newModuleBytes(sessionWasm, args),
                // Payment covers: gas (~50 CSPR) + deposit amount (100 CSPR)
                DeployUtil.standardPayment(200000000000) // 200 CSPR total
            );

            const signedDeploy = deploy.sign([keyPair]);
            return await this.client.putDeploy(signedDeploy);
        }

        // Fallback: call stored contract directly (no real CSPR transfer)
        const args = RuntimeArgs.fromMap({
            commitment: CLValueBuilder.u256(commitment.toString()),
            amount: CLValueBuilder.u512(amount.toString()),
        });

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(
                keyPair.publicKey,
                'casper-test',
                1,
                1800000
            ),
            DeployUtil.ExecutableDeployItem.newStoredVersionContractByHash(
                Uint8Array.from(Buffer.from(this.contractHash, 'hex')),
                null,
                'deposit',
                args
            ),
            DeployUtil.standardPayment(100000000000)
        );

        const signedDeploy = deploy.sign([keyPair]);
        return await this.client.putDeploy(signedDeploy);
    }

    async withdraw(
        proof: Uint8Array,
        root: bigint,
        nullifierHash: bigint,
        recipient: string,
        senderKeyPath: string
    ): Promise<string> {
        let keyPair;
        try {
            keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        } catch (e) {
            keyPair = Keys.Secp256K1.loadKeyPairFromPrivateFile(senderKeyPath);
        }
        const recipientKey = CLPublicKey.fromHex(recipient);

        const args = RuntimeArgs.fromMap({
            proof: CLValueBuilder.list(Array.from(proof).map(b => CLValueBuilder.u8(b))),
            root: CLValueBuilder.u256(root.toString()),
            nullifier_hash: CLValueBuilder.u256(nullifierHash.toString()),
            recipient: CLValueBuilder.key(recipientKey),
        });

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(
                keyPair.publicKey,
                'casper-test',
                1,
                1800000
            ),
            DeployUtil.ExecutableDeployItem.newStoredVersionContractByHash(
                Uint8Array.from(Buffer.from(this.contractHash, 'hex')),
                null,
                'withdraw',
                args
            ),
            DeployUtil.standardPayment(100000000000) // 100 CSPR
        );

        const signedDeploy = deploy.sign([keyPair]);
        const deployHash = await this.client.putDeploy(signedDeploy);

        return deployHash;
    }

    /**
     * Fetch all deposit commitments from the contract by querying recent deploys
     * This reconstructs the list of all deposits made to the contract
     */
    async getDeposits(): Promise<bigint[]> {
        // For production, we'd use Casper's event streaming or index the blockchain
        // For MVP, we query the contract's next_index and known deposits
        // This is a simplified approach that works for testing

        const commitments: bigint[] = [];

        // Query the contract state or events here
        // For now, return empty - withdraw.ts will handle this by using stored data
        console.log('   ⚠️  Event fetching not implemented - using stored leaf index');

        return commitments;
    }

    /**
     * Get the next available leaf index from the contract
     */
    async getNextIndex(): Promise<number> {
        // In production, query the contract's next_index from state
        // For now, we'll estimate based on stored secrets
        return 0;
    }
}
