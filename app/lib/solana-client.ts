import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

const requestedNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
if (requestedNetwork && requestedNetwork !== "devnet") {
  throw new Error("CH1KO only supports Solana Devnet in this phase. Set NEXT_PUBLIC_SOLANA_NETWORK=devnet.");
}
export const SOLANA_NETWORK = "devnet" as const;
export const SOLANA_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
const DEVNET_GENESIS_HASH = "GH7ome3EiwEr7tu9JuTh2dpYWBJK3z69Xm1ZE3MEE6JC";

// This is a browser wallet client, and its payer is always the explicitly connected wallet.
export const solanaClient = createClient()
  .use(walletSigner({ chain: "solana:devnet" }))
  .use(solanaRpc({ rpcUrl: SOLANA_RPC_URL }));

export type AppSolanaClient = typeof solanaClient;

export async function assertSolanaDevnet(): Promise<void> {
  const genesisHash = await solanaClient.rpc.getGenesisHash().send();
  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error("The configured Solana RPC is not the expected Devnet cluster. No transaction was sent.");
  }
}
