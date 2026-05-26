import { Command } from 'commander';
import { depositCommand } from './deposit';
import { depositBatchCommand } from './deposit_batch';
import { withdrawCommand } from './withdraw';
import { withdrawBatchCommand } from './withdraw_batch';
import { economicsReportCommand } from './economics';
import { DENOMINATION_LABEL } from './config';

const program = new Command();

program
    .name('shroud-cli')
    .description('CLI for Shroud Protocol Privacy Mixer')
    .version('1.0.0');

program.command('deposit')
    .description(`Deposit ${DENOMINATION_LABEL} into the mixer`)
    .requiredOption('-n, --node <url>', 'Casper node URL')
    .requiredOption('-c, --contract <hash>', 'Contract hash')
    .requiredOption('-k, --key <path>', 'Path to sender secret key')
    .requiredOption('-o, --output <path>', 'Output file for secrets')
    .option('-S, --session <path>', 'Path to session WASM for real CSPR transfer')
    .action(async (options) => {
        try {
            await depositCommand(options.node, options.contract, options.key, options.output, options.session);
        } catch (e) {
            console.error(e);
        }
    });

program.command('withdraw')
    .description(`Withdraw ${DENOMINATION_LABEL} from the mixer`)
    .requiredOption('-n, --node <url>', 'Casper node URL')
    .requiredOption('-c, --contract <hash>', 'Contract hash')
    .requiredOption('-s, --secrets <path>', 'Path to secrets file')
    .requiredOption('-r, --recipient <key>', 'Recipient public key (hex)')
    .requiredOption('-k, --key <path>', 'Path to sender secret key (for gas)')
    .requiredOption('-w, --wasm <path>', 'Path to circuit WASM')
    .requiredOption('-z, --zkey <path>', 'Path to proving key')
    .option('--relayer <key>', 'Relayer public key (hex). Defaults to recipient (self-withdrawal)')
    .option('--fee <motes>', 'Relayer fee in motes. Protocol fee (25 bps) is deducted automatically on top', '0')
    .action(async (options) => {
        try {
            const fee = BigInt(options.fee);
            await withdrawCommand(
                options.node,
                options.contract,
                options.recipient,
                options.secrets,
                options.wasm,
                options.zkey,
                options.key,
                options.relayer,
                fee,
            );
        } catch (e) {
            console.error(e);
        }
    });

program.command('deposit-batch')
    .description(`Deposit N × ${DENOMINATION_LABEL} in a single transaction (N ≤ 10)`)
    .requiredOption('-n, --node <url>', 'Casper node URL')
    .requiredOption('-c, --contract <hash>', 'Contract hash')
    .requiredOption('-k, --key <path>', 'Path to sender secret key')
    .requiredOption('-o, --output-dir <path>', 'Directory to write N secret JSON files into')
    .requiredOption('--count <n>', 'Number of deposits to batch (1-10)')
    .requiredOption('-S, --session <path>', 'Path to deposit_session_batch.wasm')
    .action(async (options) => {
        try {
            const count = Number.parseInt(options.count, 10);
            if (!Number.isFinite(count) || count < 1 || count > 10) {
                throw new Error('--count must be an integer between 1 and 10');
            }
            await depositBatchCommand(
                options.node,
                options.contract,
                options.key,
                options.outputDir,
                count,
                options.session,
            );
        } catch (e) {
            console.error(e);
        }
    });

program.command('withdraw-batch')
    .description(`Withdraw all secrets in a directory in a single transaction (≤ 10)`)
    .requiredOption('-n, --node <url>', 'Casper node URL')
    .requiredOption('-c, --contract <hash>', 'Contract hash')
    .requiredOption('-s, --secrets-dir <path>', 'Directory of secret JSON files')
    .requiredOption('-r, --recipient <key>', 'Recipient public key (hex) — same for all in batch')
    .requiredOption('-k, --key <path>', 'Path to sender secret key (for gas)')
    .requiredOption('-w, --wasm <path>', 'Path to circuit WASM')
    .requiredOption('-z, --zkey <path>', 'Path to proving key')
    .option('--relayer <key>', 'Relayer public key (hex). Defaults to recipient')
    .option('--fee <motes>', 'Relayer fee per withdrawal (motes)', '0')
    .action(async (options) => {
        try {
            const fee = BigInt(options.fee);
            await withdrawBatchCommand(
                options.node,
                options.contract,
                options.secretsDir,
                options.recipient,
                options.key,
                options.wasm,
                options.zkey,
                options.relayer,
                fee,
            );
        } catch (e) {
            console.error(e);
        }
    });

program.command('economics-report')
    .description('Generate roadmap/whitepaper denomination KPI report')
    .requiredOption('-n, --node <url>', 'Casper node URL')
    .requiredOption('-c, --contract <hash>', 'Contract hash')
    .requiredOption('-o, --out <path>', 'Output JSON path')
    .option('-w, --window-days <number>', 'Rolling window length in days', '60')
    .option('--open-beta', 'Enable open beta freeze rule')
    .option('--min-samples <number>', 'Minimum window deposits before emitting a KEEP/REVIEW/FREEZE verdict (otherwise INSUFFICIENT_DATA)', '14')
    .action(async (options) => {
        try {
            const windowDays = Number.parseInt(options.windowDays, 10);
            if (!Number.isFinite(windowDays) || windowDays <= 0) {
                throw new Error('window-days must be a positive integer');
            }
            const minSamples = Number.parseInt(options.minSamples, 10);
            if (!Number.isFinite(minSamples) || minSamples < 0) {
                throw new Error('min-samples must be a non-negative integer');
            }
            await economicsReportCommand(
                options.node,
                options.contract,
                options.out,
                windowDays,
                Boolean(options.openBeta),
                minSamples,
            );
        } catch (e) {
            console.error(e);
        }
    });

program.parse();
