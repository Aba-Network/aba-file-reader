import { toHex } from 'chia-bls';
import { FullNode, sanitizeHex, toCoinId } from 'chia-rpc';
import { Program } from 'clvm-lib';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as crypto from 'crypto';
const zlib = require('zlib');

dotenv.config();


const dir = path.join(__dirname, '.');
const chain = process.env.CHAIN || "aba";

if ([ "aba", "chia" ].includes(chain) === false) {
    throw new Error(`Invalid chain value: ${chain}. Allowed values are "aba" and "chia".`);
}

const node = new FullNode(os.homedir() + '/.' + chain + '/mainnet');

interface SyncInfo {
    parent: string;
    current: string;
}

async function sync(): Promise<SyncInfo> {
    const eveCoinId = process.env.EVE_COIN_ID!;
    // TODO , handle bad or unset eveCoinID
    if (typeof eveCoinId !== 'string' || !/^[a-zA-Z0-9]+$/.test(eveCoinId)) {
        throw new Error('Invalid Eve Coin ID');
    }

    let current = eveCoinId;
    let parent = current;

    while (true) {
        // Fetch coins created by the current coin
        const coinRecords = await node.getCoinRecordsByParentIds(
            [current],
            undefined,
            undefined,
            true
        );
        if (!coinRecords.success) throw new Error(coinRecords.error);

        if (current != eveCoinId) {
            //console.log("getting message, coinid:" + current);
            let msg = (await getMessage({ parent, current, })).toString(); // current coin's message
            //console.log(msg);
            //fs.writeFileSync(current+'.txt', msg);
        }
        // If there are none, we are already synced
        if (!coinRecords.coin_records.length) break;

        // Update the parent
        parent = current;

        // Continue with the child coin as the new singleton
        const coinRecord = coinRecords.coin_records[0];
        current = toHex(toCoinId(coinRecord.coin));
    }

    return {
        parent,
        current,
    };
}

async function getMessage(syncInfo: SyncInfo): Promise<Program> {
    const coinRecord = await node.getCoinRecordByName(syncInfo.parent);
    if (!coinRecord.success) { console.log(syncInfo.parent); }
    if (!coinRecord.success) throw new Error(coinRecord.error);

    const puzzleAndSolution = await node.getPuzzleAndSolution(
        syncInfo.parent,
        coinRecord.coin_record.spent_block_index
    );
    if (!puzzleAndSolution.success) throw new Error(puzzleAndSolution.error);

    const spend = puzzleAndSolution.coin_solution;

    const solution = Program.deserializeHex(
        sanitizeHex(spend.solution)
    ).toList();

    return solution[0];
}

async function printMessage(fileCoinId: string) {
    process.env.EVE_COIN_ID = fileCoinId;
    const syncInfo = await sync();
    const message = await getMessage(syncInfo);
    console.log('Message:', message.toString());
}

async function writeBinaryFile(filePath: string, data: Uint8Array): Promise<void> {
    try {
      await fs.writeFileSync(filePath, data);
    } catch (err) {
      throw err;
    }
}

async function getCoinMessage(syncInfo: SyncInfo): Promise<Program> {
    console.log("getcoinmessage " + (new Date()).toLocaleString());
    const coinRecord = await node.getCoinRecordByName(syncInfo.parent);
    //console.log("coin gotten by name " + (new Date()).toLocaleString());
    if (!coinRecord.success) { console.log(syncInfo.parent); }
    if (!coinRecord.success) throw new Error(coinRecord.error);

    //console.log("get puz and solution " + (new Date()).toLocaleString());
    const puzzleAndSolution = await node.getPuzzleAndSolution(
        syncInfo.parent,
        coinRecord.coin_record.spent_block_index
    );
    if (!puzzleAndSolution.success) throw new Error(puzzleAndSolution.error);
    //console.log("gotten puz soln " + (new Date()).toLocaleString());
    const spend = puzzleAndSolution.coin_solution;
    const sanitized = sanitizeHex(spend.solution)
    //console.log("sanitized done " + (new Date()).toLocaleString());
    const solution = Program.deserializeHex(sanitized).toList();
    console.log("deserialized " + (new Date()).toLocaleString());
    return solution[0];
}

async function renameToHashes() {
    // rename chunk files to be named by their sha256 hashes .chunk
    const tempDir = 'temp/';

    fs.readdirSync(tempDir).forEach(file => {
        if (path.extname(file) === '.chunk') {
            const filePath = path.join(tempDir, file);
            const fileBuffer = fs.readFileSync(filePath);
            //const sha256sum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const sha256sum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const newFilePath = path.join(tempDir, `${sha256sum}.chunk`);
            console.log("renaming " + filePath + " to " + newFilePath);
            fs.renameSync(filePath, newFilePath);
        }
    });
}


async function getPublishedFile(fileCoinId: string, fileIndex?: string): Promise<[boolean, string, string[]]> {
    // get published file from the blockchain
    const date = new Date();
    //console.log(date.toLocaleString());

    // get coin w/ index of hashes etc.; if not available use fileIndex
    const eveCoinId = fileCoinId; //process.env.FILE_COIN_ID!;
    let current = eveCoinId;
    let parent = current;
    let fileIndexObj = JSON.parse("{}");
    // if we're given fileIndex, we'll use that
    if (fileIndex === undefined) {
        // first we get the index / description.json NOTE TODO: still assumes it's the first one
        // FIX THIS LATER
        fileIndex = (await getCoinMessage({parent, current})).toString().replace(/^'|'$/g, '');
        console.log(fileIndex);
    }
    //console.log('File Index Info:', indexMessage);

    // parse the chunks from the index TODO going back in the inheritance of the spends
    //else {
    fileIndexObj = JSON.parse(fileIndex.trim());
    //}
    //console.log("# of chunks: " + fileIndexObj.hashChunks.length);
    console.log(fileIndexObj);
    // go through sequence of hashes and save each chunk
    let chunks = 0;
    let msg = new Uint8Array(0);
    const hashChunks = fileIndexObj.hashChunks;
    console.log(hashChunks);
    for (const hash in hashChunks) {
        if (Object.prototype.hasOwnProperty.call(hashChunks, hash)) {
          const coinId = hashChunks[hash];
          console.log(`Hash: ${hash}, Coin ID: ${coinId}`);
          const current = coinId;
          const parent = current;
            if (current != eveCoinId) {
                //console.log((new Date()).toLocaleString());
                msg = (await getCoinMessage({ parent, current, })).toBytes(); // current coin's message
                console.log(msg.length);
                //console.log((new Date()).toLocaleString());
                //if (fileIndexObj.mediaType == "text/plain") {
                //    await writeTextFile("temp/" + current + ".chunk", msg);
                //}
                await writeBinaryFile("temp/" + current + ".chunk", msg);
                console.log((new Date()).toLocaleString());
            }

            // Continue with the child coin as the new singleton
            chunks++;
            console.log("new current: " + current + " chunk #: " + chunks);

        }
    }

    // hash and rename chunks
    await renameToHashes(); // TODO something ain't working yet; what if there's collision of hash vs coinid?

    // report on missing chunks if incomplete
    let numChunks = 0;
    let doneHashes: string[] = [];
    for (const hash in hashChunks) {
            // check if file hash.chunk exists
            const filePath = "temp/" + hash + ".chunk";
            if (fs.existsSync(filePath)) { 
                doneHashes.push(hash);
                numChunks++;
            }
    }

    // concat chunks if complete
    let complete = false;
    if ( numChunks == Object.keys(hashChunks).length) {
        // TODO really do security review on all these file operations
        const outfile = path.join('temp/',path.basename(fileIndexObj.filename));
        try {  
            fs.unlinkSync(outfile); 
        }
        catch (err) { }
        //const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND;
        //const mode = fs.constants.O_BINARY;
        for (const hash in hashChunks) {
            console.log(hash);
            
            await fs.appendFileSync(outfile, await fs.readFileSync("temp/" + hash + ".chunk"));
        }
        // check the hash
        const fileBuffer = fs.readFileSync(outfile);
        const sha256sum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        if (sha256sum === fileIndexObj.hash) {
            console.log("File hash: " + sha256sum);
            console.log("Success. File hash matches.");
            complete = true;
            console.log("File saved as: " + outfile);
        }
        else {
            console.log("FAIL file hash doesn't match up");
        }
    }
    else {
        console.log("FAIL File incomplete. Only " + numChunks + " of " + fileIndexObj.hashes.length + " chunks found");
    }
    //console.log((new Date()).toLocaleString());
    return [complete, current, doneHashes];
}

const arg1 = process.argv[2] || '2';
if (arg1 === '2' || arg1 === 'p' || arg1 === 'read') {
    printMessage(process.argv[3]);
}
if (arg1 === '6' || arg1 === 'g' || arg1 === 'get') {
    getPublishedFile(process.argv[3]);
}