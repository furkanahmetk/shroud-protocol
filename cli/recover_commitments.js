const https = require('https');

const CONTRACT_PACKAGE_HASH = 'eab05369d5f955239217e3bf2d11d15b996bbb14c7138812591eb2347dfeba4b';

// Endpoint used by CSPR.live
const API_URL = `https://event-store-api-clarity-testnet.make.services/deploys?contract_package_hash=${CONTRACT_PACKAGE_HASH}&fields=args&limit=100`;

function fetchDeploys() {
    console.log('Fetching deploys from Explorer API...');
    https.get(API_URL, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (!json.data) {
                    console.log('No data found');
                    return;
                }

                const deposits = [];

                // Process deploys
                json.data.forEach(deploy => {
                    if (deploy.entry_point === 'deposit' && deploy.execution_results[0]?.result === 'Success') {
                        // Extract commitment arg
                        const args = deploy.args; // might be in different format
                        // Usually args is { "commitment": { "parsed": "..." } } or similar

                        let commitment = null;

                        // Check Args format
                        if (args.commitment) {
                            if (typeof args.commitment === 'string') commitment = args.commitment;
                            else if (args.commitment.parsed) commitment = args.commitment.parsed;
                        } else if (Array.isArray(args)) {
                            // Named args array
                            const cArg = args.find(a => a.name === 'commitment');
                            if (cArg && cArg.parsed) commitment = cArg.parsed;
                        }

                        if (commitment) {
                            deposits.push({
                                commitment: commitment,
                                timestamp: deploy.timestamp,
                                hash: deploy.deploy_hash
                            });
                        }
                    }
                });

                // Sort by timestamp asc
                deposits.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const commitmentList = deposits.map(d => d.commitment);
                console.log('\n✅ FOUND', commitmentList.length, 'DEPOSITS:');
                console.log(JSON.stringify(commitmentList, null, 2));

            } catch (e) {
                console.error('Error parsing JSON:', e.message);
                console.log('Raw data:', data.substring(0, 200));
            }
        });
    }).on('error', err => {
        console.error('Request failed:', err.message);
    });
}

fetchDeploys();
