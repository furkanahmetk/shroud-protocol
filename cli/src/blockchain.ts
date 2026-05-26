import { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder, Keys } from 'casper-js-sdk';
import * as fs from 'fs';
import {
    DEFAULT_DEPOSIT_PAYMENT_BUFFER_MOTES,
    DEFAULT_WITHDRAW_PAYMENT_MOTES
} from './config';

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
                // Payment covers: deposit amount + conservative gas buffer.
                DeployUtil.standardPayment((amount + DEFAULT_DEPOSIT_PAYMENT_BUFFER_MOTES).toString())
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
            DeployUtil.standardPayment(DEFAULT_WITHDRAW_PAYMENT_MOTES.toString())
        );

        const signedDeploy = deploy.sign([keyPair]);
        return await this.client.putDeploy(signedDeploy);
    }

    async withdraw(
        proof: Uint8Array,
        root: bigint,
        nullifierHash: bigint,
        recipient: string,
        relayer: string,
        fee: bigint,
        senderKeyPath: string
    ): Promise<string> {
        let keyPair;
        try {
            keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        } catch (e) {
            keyPair = Keys.Secp256K1.loadKeyPairFromPrivateFile(senderKeyPath);
        }
        const recipientKey = CLPublicKey.fromHex(recipient);
        const relayerKey = CLPublicKey.fromHex(relayer);

        const args = RuntimeArgs.fromMap({
            proof: CLValueBuilder.list(Array.from(proof).map(b => CLValueBuilder.u8(b))),
            root: CLValueBuilder.u256(root.toString()),
            nullifier_hash: CLValueBuilder.u256(nullifierHash.toString()),
            recipient: CLValueBuilder.key(recipientKey),
            relayer: CLValueBuilder.key(relayerKey),
            fee: CLValueBuilder.u512(fee.toString()),
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
            DeployUtil.standardPayment(DEFAULT_WITHDRAW_PAYMENT_MOTES.toString())
        );

        const signedDeploy = deploy.sign([keyPair]);
        const deployHash = await this.client.putDeploy(signedDeploy);

        return deployHash;
    }

    /**
     * Batch deposit: N commitments in a single transaction.
     * `amount` MUST equal `N * DENOMINATION`. Atomic — any duplicate reverts all.
     */
    async depositBatch(
        commitments: bigint[],
        amount: bigint,
        senderKeyPath: string,
        sessionWasmPath: string
    ): Promise<string> {
        if (!fs.existsSync(sessionWasmPath)) {
            throw new Error(`deposit_session_batch.wasm not found at ${sessionWasmPath}`);
        }
        let keyPair;
        try {
            keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        } catch (e) {
            keyPair = Keys.Secp256K1.loadKeyPairFromPrivateFile(senderKeyPath);
        }

        const sessionWasm = new Uint8Array(fs.readFileSync(sessionWasmPath));
        const commitmentClvs = commitments.map(c => CLValueBuilder.u256(c.toString()));

        const args = RuntimeArgs.fromMap({
            contract_package_hash: CLValueBuilder.byteArray(Buffer.from(this.contractHash, 'hex')),
            commitments: CLValueBuilder.list(commitmentClvs),
            amount: CLValueBuilder.u512(amount.toString()),
        });

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(keyPair.publicKey, NETWORK_NAME, 1, 1800000),
            DeployUtil.ExecutableDeployItem.newModuleBytes(sessionWasm, args),
            DeployUtil.standardPayment((amount + DEFAULT_DEPOSIT_PAYMENT_BUFFER_MOTES).toString())
        );

        const signedDeploy = deploy.sign([keyPair]);
        return await this.client.putDeploy(signedDeploy);
    }

    /**
     * Batch withdraw: N independent withdrawals in a single tx.
     * Each tuple is verified independently; any invalid proof reverts all.
     */
    async withdrawBatch(
        proofs: Uint8Array[],
        roots: bigint[],
        nullifierHashes: bigint[],
        recipients: string[],
        relayers: string[],
        fees: bigint[],
        senderKeyPath: string
    ): Promise<string> {
        const n = proofs.length;
        if (
            roots.length !== n
            || nullifierHashes.length !== n
            || recipients.length !== n
            || relayers.length !== n
            || fees.length !== n
        ) {
            throw new Error('withdrawBatch: all input arrays must have the same length');
        }

        let keyPair;
        try {
            keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(senderKeyPath);
        } catch (e) {
            keyPair = Keys.Secp256K1.loadKeyPairFromPrivateFile(senderKeyPath);
        }

        const proofsClv = CLValueBuilder.list(
            proofs.map(p => CLValueBuilder.list(Array.from(p).map(b => CLValueBuilder.u8(b))))
        );
        const rootsClv = CLValueBuilder.list(roots.map(r => CLValueBuilder.u256(r.toString())));
        const nullifiersClv = CLValueBuilder.list(
            nullifierHashes.map(n => CLValueBuilder.u256(n.toString()))
        );
        const recipientsClv = CLValueBuilder.list(
            recipients.map(r => CLValueBuilder.key(CLPublicKey.fromHex(r)))
        );
        const relayersClv = CLValueBuilder.list(
            relayers.map(r => CLValueBuilder.key(CLPublicKey.fromHex(r)))
        );
        const feesClv = CLValueBuilder.list(fees.map(f => CLValueBuilder.u512(f.toString())));

        const args = RuntimeArgs.fromMap({
            proofs: proofsClv,
            roots: rootsClv,
            nullifier_hashes: nullifiersClv,
            recipients: recipientsClv,
            relayers: relayersClv,
            fees: feesClv,
        });

        // Scale payment with N — verifier cost dominates and is linear in batch size.
        const payment = DEFAULT_WITHDRAW_PAYMENT_MOTES * BigInt(n);

        const deploy = DeployUtil.makeDeploy(
            new DeployUtil.DeployParams(keyPair.publicKey, NETWORK_NAME, 1, 1800000),
            DeployUtil.ExecutableDeployItem.newStoredVersionContractByHash(
                Uint8Array.from(Buffer.from(this.contractHash, 'hex')),
                null,
                'withdraw_batch',
                args
            ),
            DeployUtil.standardPayment(payment.toString())
        );

        const signedDeploy = deploy.sign([keyPair]);
        return await this.client.putDeploy(signedDeploy);
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
        let mainPurse = 'uref-a4a21274a56589f679b7a86c69c74081e31249a002c7891651bbe42e2685a4cf-007';
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
                        // Single deposit: scalar `commitment`
                        const commitmentValue = args.commitment?.parsed ||
                            (Array.isArray(args) ? args.find((a: any) => a.name === 'commitment' || a[0] === 'commitment')?.parsed : null);
                        if (commitmentValue) {
                            commitments.push(BigInt(commitmentValue.toString()));
                        }

                        // Batch deposit: List<U256> `commitments` (plural)
                        const batchCommitments = args.commitments?.parsed ||
                            (Array.isArray(args) ? args.find((a: any) => a.name === 'commitments' || a[0] === 'commitments')?.parsed : null);
                        if (Array.isArray(batchCommitments)) {
                            for (const c of batchCommitments) {
                                if (c !== undefined && c !== null) {
                                    commitments.push(BigInt(c.toString()));
                                }
                            }
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
