import * as fs from "fs/promises";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { mnemonicToWalletKey } from "ton-crypto";
import { TonClient, WalletContractV4, internal } from "ton";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env" });

async function addrList(): Promise<string[]> {
  let addr: string[] = [];

  try {
    const data = await fs.readFile("src/address.txt", "utf-8");
    const lines = data.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        addr[i] = line;
      }
    }

    return addr;
  } catch (err) {
    console.error("Error membaca file:", err);
    return [];
  }
}

async function multiSendTON(
  toAddress: string,
  amount: number,
  index: number
): Promise<void> {
  index++;

  try {
    let mnemonic = process.env.MNEMONIC;
    if (mnemonic == null) {
      mnemonic = "";
      console.log("fill your mnemonic");
    } else {
      const key = await mnemonicToWalletKey(mnemonic.split(" "));
      const wallet = WalletContractV4.create({
        publicKey: key.publicKey,
        workchain: 0,
      });

      const endpoint = await getHttpEndpoint({ network: "mainnet" });
      const client = new TonClient({ endpoint });

      if (!(await client.isContractDeployed(wallet.address))) {
        return console.log("wallet is not deployed");
      }

      const walletContract = client.open(wallet);
      const seqno = await walletContract.getSeqno();
      let balance: bigint = await walletContract.getBalance();

      // Konversi balance dari nanoTON ke TON
      let balanceInTON = Number(balance) / 1e9;
      let balanceFormatted = balanceInTON.toFixed(4);

      console.log(`balance wallet : ${balanceFormatted} TON`);

      if (Number(balance) < 0) {
        console.log(`didn't enough for fee`);
      } else {
        console.log(`amount TON for sending : ${amount} TON`);
        console.log(`start for transaction ${index}, sent TON to ${toAddress}`);

        await walletContract.sendTransfer({
          secretKey: key.secretKey,
          seqno: seqno,
          messages: [
            internal({
              to: toAddress,
              value: `${amount}`,
              body: `sending ${amount} TON from ${wallet.address}`,
              bounce: false,
            }),
          ],
        });

        let currentSeqno = seqno;
        while (currentSeqno == seqno) {
          console.log(`waiting for transaction ${index} to confirm...`);
          await sleep(1500);
          currentSeqno = await walletContract.getSeqno();
        }
        console.log(`transaction ${index} confirmed!`);
        console.log(`success send ${amount} TON to address ${toAddress} !\n`);
      }
    }
  } catch (err) {
    console.error(`error on tx  ${index} while transfer TON:`, err);
  }
}

async function main(): Promise<void> {
  console.log("Starting bot...");
  const addresses = await addrList();

  console.log(`total address : ${addresses.length}`);
  let amount = Number(process.env.AMOUNT);

  if (typeof amount === "string") {
    amount = 0.1;
  }

  for (let index = 0; index < addresses.length; index++) {
    const address = addresses[index];
    await multiSendTON(address, amount, index);
  }

  console.log("All Transaction have been proceed");
}

main();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
