import { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder } from 'casper-js-sdk';

const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL || 'https://node.testnet.casper.network/rpc';
const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME || 'casper-test';
const CONTRACT_HASH = process.env.NEXT_PUBLIC_CONTRACT_HASH || 'hash-5ebf4ad5f80e5b5613df0506d13d95225150487ac4434cf2c0ffba22d743fa14';

export const createDepositDeploy = (
    activeKey: string,
    commitment: bigint,
    amount: bigint
) => {
    const senderKey = CLPublicKey.fromHex(activeKey);

    // Construct args
    // Note: We relaxed the attached_value check in contract for MVP, 
    // but we should still try to pass amount if possible or just rely on args.
    const args = RuntimeArgs.fromMap({
        commitment: CLValueBuilder.u256(commitment),
        amount: CLValueBuilder.u512(amount),
    });

    const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
            senderKey,
            NETWORK_NAME,
            1,
            1800000 // Gas limit
        ),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
            Uint8Array.from(Buffer.from(CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH, 'hex')),
            'deposit',
            args
        ),
        DeployUtil.standardPayment(5000000000) // 5 CSPR payment
    );

    return DeployUtil.deployToJson(deploy);
};

export const createWithdrawDeploy = (
    activeKey: string,
    proof: Uint8Array,
    root: bigint,
    nullifierHash: bigint,
    recipient: string
) => {
    const senderKey = CLPublicKey.fromHex(activeKey);
    const recipientKey = CLPublicKey.fromHex(recipient);

    const args = RuntimeArgs.fromMap({
        proof: CLValueBuilder.list(Array.from(proof).map(b => CLValueBuilder.u8(b))),
        root: CLValueBuilder.u256(root),
        nullifier_hash: CLValueBuilder.u256(nullifierHash),
        recipient: CLValueBuilder.key(recipientKey),
    });

    const deploy = DeployUtil.makeDeploy(
        new DeployUtil.DeployParams(
            senderKey,
            NETWORK_NAME,
            1,
            1800000 // Gas limit
        ),
        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
            Uint8Array.from(Buffer.from(CONTRACT_HASH.startsWith('hash-') ? CONTRACT_HASH.slice(5) : CONTRACT_HASH, 'hex')),
            'withdraw',
            args
        ),
        DeployUtil.standardPayment(10000000000) // 10 CSPR payment
    );

    return DeployUtil.deployToJson(deploy);
};

export const sendSignedDeploy = async (signedDeployJson: any) => {
    const client = new CasperClient(NODE_URL);
    const deploy = DeployUtil.deployFromJson(signedDeployJson).unwrap();
    return await client.putDeploy(deploy);
};
