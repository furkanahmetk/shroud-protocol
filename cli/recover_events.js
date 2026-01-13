const { CasperClient } = require('casper-js-sdk');
const blake2b = require('blake2b');
const client = new CasperClient('https://node.testnet.casper.network/rpc');

const eventsUrefStr = 'uref-47a65987b775a40fe74d61e74d397a14ff9c87eff7687b4e8eac0df2510e0366-007';

function getDictionaryItemKey(urefStr, index, mode) {
    const parts = urefStr.split('-');
    const urefHex = parts[1];
    const rightsVal = parseInt(parts[2], 8);

    const urefBytes = Buffer.from(urefHex, 'hex'); // 32 bytes
    const rightsByte = Buffer.from([rightsVal]);   // 1 byte

    // Key Bytes
    const keyBuf4 = Buffer.alloc(4);
    keyBuf4.writeUInt32LE(index); // 4 bytes

    const keyBufTag = Buffer.concat([Buffer.from([0x04]), keyBuf4]); // 5 bytes (Tag U32)
    const keyBufString = Buffer.from(index.toString()); // String bytes '0'
    const keyBufStringTag = Buffer.concat([Buffer.from([0x0a]), Buffer.from(index.toString())]); // Tag String does not look like this usually (needs length), skip

    let seed, key;

    switch (mode) {
        case 0: // Seed(33) + Key(4)
            seed = Buffer.concat([urefBytes, rightsByte]);
            key = keyBuf4;
            break;
        case 1: // Seed(32) + Key(4)
            seed = urefBytes;
            key = keyBuf4;
            break;
        case 2: // Seed(33) + Key(5)
            seed = Buffer.concat([urefBytes, rightsByte]);
            key = keyBufTag;
            break;
        case 3: // Seed(32) + Key(5)
            seed = urefBytes;
            key = keyBufTag;
            break;
        case 4: // Seed(33) + Key(String)
            seed = Buffer.concat([urefBytes, rightsByte]);
            key = keyBufString;
            break;
        case 5: // Seed(32) + Key(String)
            seed = urefBytes;
            key = keyBufString;
            break;
    }

    const h = blake2b(32);
    h.update(seed);
    h.update(key);
    return Buffer.from(h.digest()).toString('hex');
}

async function recover() {
    try {
        const stateRootHash = await client.nodeClient.getStateRootHash();
        const index = 0; // Just try index 0

        for (let mode = 0; mode <= 5; mode++) {
            const dictKey = getDictionaryItemKey(eventsUrefStr, index, mode);
            // console.log(`Mode ${mode} -> ${dictKey}`);
            try {
                const item = await client.nodeClient.getDictionaryItemByURef(
                    stateRootHash,
                    eventsUrefStr,
                    dictKey
                );
                console.log(`SUCCESS! Mode ${mode} worked!`);
                console.log('Item:', JSON.stringify(item, null, 2));
                return; // Found it
            } catch (e) { }
        }
        console.log('All modes failed');

    } catch (e) { console.error(e); }
}

recover();
