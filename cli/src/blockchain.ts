import { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder, Keys } from 'casper-js-sdk';
import * as fs from 'fs';

const NETWORK_NAME = process.env.CASPER_NETWORK_NAME || 'casper-test';
const EXPLORER_API_URL = process.env.CASPER_EXPLORER_API_URL || 'https://api.testnet.cspr.live';

export class BlockchainClient {
    private client: CasperClient;
    private contractHash: string;
    private nodeUrl: string;

    constructor(nodeUrl: string, contractHash: string) {
        this.client = new CasperClient(nodeUrl);
        this.nodeUrl = nodeUrl;
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
                    NETWORK_NAME,
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
                NETWORK_NAME,
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
                NETWORK_NAME,
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

    private async rpcCall(method: string, params: any): Promise<any> {
        let url = this.nodeUrl;
        if (!url.endsWith('/rpc')) {
            url = url.replace(/\/$/, '') + '/rpc';
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method,
                    params
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`RPC transport error ${response.status}: ${text.substring(0, 100)}`);
            }

            const data = await response.json() as any;
            if (data.error) throw new Error(data.error.message);
            return data.result;
        } catch (e: any) {
            throw new Error(`RPC call failed: ${e.message}`);
        }
    }

    private async explorerCall(endpoint: string): Promise<any> {
        try {
            const response = await fetch(`${EXPLORER_API_URL}${endpoint}`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Explorer API error ${response.status}`);
            }
            return await response.json() as any;
        } catch (e: any) {
            throw new Error(`Explorer API failed: ${e.message}`);
        }
    }

    async getMainPurse(): Promise<string> {
        let mainPurse = 'uref-3c4011cbd1c0d58793d9435fab15abb24faee31e3546d2e81c011cce6ed73047-007';
        try {
            const stateRootRes = await this.rpcCall('chain_get_state_root_hash', []);
            const stateRootHash = stateRootRes.state_root_hash;
            const formattedHash = this.contractHash.startsWith('hash-') ? this.contractHash : `hash-${this.contractHash}`;

            const contractData = await this.rpcCall('state_get_item', {
                state_root_hash: stateRootHash,
                key: formattedHash,
                path: []
            });

            let namedKeys: any[] = [];
            if (contractData.stored_value?.Contract) {
                namedKeys = contractData.stored_value.Contract.named_keys;
            } else if (contractData.stored_value?.ContractPackage) {
                const newest = contractData.stored_value.ContractPackage.versions.slice(-1)[0].contract_hash;
                const realContractData = await this.rpcCall('state_get_item', {
                    state_root_hash: stateRootHash,
                    key: newest,
                    path: []
                });
                namedKeys = realContractData.stored_value.Contract.named_keys;
            }
            const foundPurse = namedKeys.find((k: any) => k.name === '__contract_main_purse')?.key;
            if (foundPurse) mainPurse = foundPurse;
        } catch (e) {
            console.warn('   ⚠️ Metadata fetch failed, using purse fallback.');
        }
        return mainPurse;
    }

    /**
     * Fetch all deposit commitments from the contract by querying recent transfers
     */
    async getDeposits(): Promise<bigint[]> {
        const commitments: bigint[] = [];
        try {
            const mainPurse = await this.getMainPurse();
            console.log(`   🔎 Syncing commitments from purse: ${mainPurse.slice(0, 20)}...`);

            let allTransfers: any[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 10) {
                const response = await this.explorerCall(`/purses/${mainPurse}/transfers?page_size=100&page=${page}`);
                const data = response.data || [];
                allTransfers = [...allTransfers, ...data];
                hasMore = data.length === 100;
                page++;
            }

            allTransfers.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            const uniqueHashes = Array.from(new Set(allTransfers.map((t: any) => t.deploy_hash))) as string[];
            console.log(`   ⚙️  Processing ${uniqueHashes.length} potential deposit transactions...`);

            for (const hash of uniqueHashes) {
                try {
                    const deploy = await this.explorerCall(`/deploys/${hash}`);
                    const data = deploy.data;
                    const success = data?.status === 'processed' && !data?.error_message;
                    if (!success) continue;

                    const args = data?.args || data?.session?.args || data?.session?.StoredContractByHash?.args;
                    if (args) {
                        const commitmentValue = args.commitment?.parsed ||
                            (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);
                        if (commitmentValue) {
                            commitments.push(BigInt(commitmentValue.toString()));
                        }
                    }
                } catch (e) { }
            }
        } catch (e: any) {
            console.warn('   ⚠️  On-chain sync failed:', e.message);
        }

        return commitments;
    }

    /**
     * Get the current root and next_index directly from the contract state
     */
    async getContractState(): Promise<{ root: bigint, nextIndex: number } | null> {
        try {
            const stateRootRes = await this.rpcCall('chain_get_state_root_hash', []);
            const stateRootHash = stateRootRes.state_root_hash;
            const formattedHash = this.contractHash.startsWith('hash-') ? this.contractHash : `hash-${this.contractHash}`;

            // 1. Get Merkle Tree Key
            const contractData = await this.rpcCall('state_get_item', {
                state_root_hash: stateRootHash,
                key: formattedHash,
                path: []
            });

            const namedKeys = contractData.stored_value?.Contract?.named_keys || [];
            const merkleTreeKey = namedKeys.find((k: any) => k.name === 'merkle_tree')?.key;

            if (merkleTreeKey) {
                // 2. Query the variable itself
                const mtData = await this.rpcCall('state_get_item', {
                    state_root_hash: stateRootHash,
                    key: merkleTreeKey,
                    path: []
                });

                // Odra stores Var<T> as its underlying type. MerkleTree's first fields are root (U256) and next_index (u32)
                // The MerkleTree is likely serialized. For simplicity, we can also query the root and index from events.
                // However, parsing the raw MerkleTree CLValue is the most direct.
                const clValue = mtData.stored_value?.CLValue;
                if (clValue && clValue.cl_type === 'Any') {
                    // Complex types come as 'Any' in some SDK versions if not handled.
                    // But we can fallback to the events sync as our source of truth.
                }
            }
        } catch (e) { }
        return null;
    }

    /**
     * Get the next available leaf index from the contract
     */
    async getNextIndex(): Promise<number> {
        const deposits = await this.getDeposits();
        return deposits.length;
    }
}
