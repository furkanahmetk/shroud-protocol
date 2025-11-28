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
        senderKeyPath: string
    ): Promise<string> {
        const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);

        const args = RuntimeArgs.fromMap({
            commitment: CLValueBuilder.u256(commitment),
            amount: CLValueBuilder.u512(amount),
        });

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(
                keyPair.publicKey,
                'casper-test', // Chain name
                1,
                1800000 // Gas limit
            ),
            DeployUtil.ExecutableDeployItem.newStoredContractByHash(
                Uint8Array.from(Buffer.from(this.contractHash, 'hex')),
                'deposit',
                args
            ),
            DeployUtil.standardPayment(5000000000) // Payment amount
        );

        const signedDeploy = deploy.sign([keyPair]);
        const deployHash = await this.client.putDeploy(signedDeploy);

        return deployHash;
    }

    async withdraw(
        proof: Uint8Array,
        root: bigint,
        nullifierHash: bigint,
        recipient: string,
        senderKeyPath: string
    ): Promise<string> {
        const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        const recipientKey = CLPublicKey.fromHex(recipient);

        const args = RuntimeArgs.fromMap({
            proof: CLValueBuilder.list(Array.from(proof).map(b => CLValueBuilder.u8(b))),
            root: CLValueBuilder.u256(root),
            nullifier_hash: CLValueBuilder.u256(nullifierHash),
            recipient: CLValueBuilder.key(recipientKey),
        });

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(
                keyPair.publicKey,
                'casper-test',
                1,
                1800000
            ),
            DeployUtil.ExecutableDeployItem.newStoredContractByHash(
                Uint8Array.from(Buffer.from(this.contractHash, 'hex')),
                'withdraw',
                args
            ),
            DeployUtil.standardPayment(10000000000)
        );

        const signedDeploy = deploy.sign([keyPair]);
        const deployHash = await this.client.putDeploy(signedDeploy);

        return deployHash;
    }
}
