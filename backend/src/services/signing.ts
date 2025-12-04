import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toHex,
  verifyMessage,
  type WalletClient,
  type Account,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import type { CouncilVerdict, SignedVerdict } from "../schemas/index.js";

let walletClient: WalletClient | null = null;
let account: Account | null = null;

/**
 * Initialize the wallet from mnemonic
 * Uses the first derived wallet (index 0)
 */
function getWallet(): { client: WalletClient; account: Account } {
  if (walletClient && account) {
    return { client: walletClient, account };
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    throw new Error("MNEMONIC environment variable is required for signing");
  }

  // Derive the first account from the mnemonic (path: m/44'/60'/0'/0/0)
  account = mnemonicToAccount(mnemonic);

  walletClient = createWalletClient({
    account,
    chain: mainnet,
    transport: http(),
  });

  console.log(`Initialized signing wallet: ${account.address}`);

  return { client: walletClient, account };
}

/**
 * Create a deterministic hash of the verdict
 */
function hashVerdict(verdict: CouncilVerdict): `0x${string}` {
  // Create a canonical JSON representation
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  return keccak256(toHex(canonical));
}

/**
 * Sign the council verdict with the judge wallet
 */
export async function signVerdict(verdict: CouncilVerdict): Promise<SignedVerdict> {
  console.log("Signing verdict...");

  const { client, account } = getWallet();
  const hash = hashVerdict(verdict);

  // Sign the hash
  const signature = await client.signMessage({
    account,
    message: { raw: hash },
  });

  const signedVerdict: SignedVerdict = {
    verdict,
    hash,
    signature,
    signerAddress: account.address,
    timestamp: Date.now(),
  };

  console.log(`Verdict signed by ${account.address}`);
  console.log(`Hash: ${hash}`);

  return signedVerdict;
}

/**
 * Get the signer address
 */
export function getSignerAddress(): string {
  const { account } = getWallet();
  return account.address;
}

/**
 * Verify a signed verdict
 * Returns true if the signature is valid and matches the expected signer
 */
export async function verifySignedVerdict(
  verdict: CouncilVerdict,
  hash: `0x${string}`,
  signature: `0x${string}`,
  claimedSigner: string
): Promise<{ valid: boolean; expectedSigner: string; recoveredSigner: string | null; hashMatch: boolean }> {
  const { account } = getWallet();
  const expectedSigner = account.address;
  
  // Verify the hash matches the verdict
  const computedHash = hashVerdict(verdict);
  const hashMatch = computedHash.toLowerCase() === hash.toLowerCase();
  
  if (!hashMatch) {
    return {
      valid: false,
      expectedSigner,
      recoveredSigner: null,
      hashMatch: false,
    };
  }

  try {
    // Verify the signature
    const isValid = await verifyMessage({
      address: expectedSigner as `0x${string}`,
      message: { raw: hash },
      signature,
    });

    return {
      valid: isValid && claimedSigner.toLowerCase() === expectedSigner.toLowerCase(),
      expectedSigner,
      recoveredSigner: isValid ? expectedSigner : null,
      hashMatch: true,
    };
  } catch (error) {
    console.error("Signature verification failed:", error);
    return {
      valid: false,
      expectedSigner,
      recoveredSigner: null,
      hashMatch: true,
    };
  }
}

