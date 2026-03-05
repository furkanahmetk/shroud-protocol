import { Command } from 'commander';
import { depositCommand } from './deposit';
import { withdrawCommand } from './withdraw';
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
    .action(async (options) => {
        try {
            await withdrawCommand(options.node, options.contract, options.recipient, options.secrets, options.wasm, options.zkey, options.key);
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
    .action(async (options) => {
        try {
            const windowDays = Number.parseInt(options.windowDays, 10);
            if (!Number.isFinite(windowDays) || windowDays <= 0) {
                throw new Error('window-days must be a positive integer');
            }
            await economicsReportCommand(
                options.node,
                options.contract,
                options.out,
                windowDays,
                Boolean(options.openBeta)
            );
        } catch (e) {
            console.error(e);
        }
    });

program.parse();
