import { Command } from 'commander';
import { depositCommand } from './deposit';
import { withdrawCommand } from './withdraw';

const program = new Command();

program
    .name('shroud-cli')
    .description('CLI for Shroud Protocol Privacy Mixer')
    .version('1.0.0');

program.command('deposit')
    .description('Deposit 100 CSPR into the mixer')
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
    .description('Withdraw 100 CSPR from the mixer')
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

program.parse();
