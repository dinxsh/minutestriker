import "../polyfills.js";
import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import txoracleIdl from "./txoracle.json";

const DEFAULT_WEEKS = 4;

export async function subscribeAndActivateWorldCup({ provider, readiness, leagues = [] }) {
  if (!provider?.publicKey || !provider?.signTransaction || !provider?.signMessage) {
    throw new Error("Connected wallet must support Solana transaction and message signing");
  }

  const walletPublicKey = new PublicKey(provider.publicKey.toString());
  const connection = await firstHealthyConnection(rpcUrlsFrom(readiness));
  const walletAdapter = {
    publicKey: walletPublicKey,
    signTransaction: provider.signTransaction.bind(provider),
    signAllTransactions: provider.signAllTransactions
      ? provider.signAllTransactions.bind(provider)
      : async (transactions) => Promise.all(transactions.map((transaction) => provider.signTransaction(transaction))),
  };
  const anchorProvider = new AnchorProvider(connection, walletAdapter, { commitment: "confirmed" });
  const program = new Program({ ...txoracleIdl, address: readiness.programId }, anchorProvider);
  const programId = new PublicKey(readiness.programId);
  const txlTokenMint = new PublicKey(readiness.txlTokenMint);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    programId,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    walletPublicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  await ensureAssociatedTokenAccount({ connection, provider, owner: walletPublicKey, tokenMint: txlTokenMint, tokenAccount: userTokenAccount });

  const subscriptionTx = await program.methods
    .subscribe(new BN(Number(readiness.serviceLevel)), new BN(DEFAULT_WEEKS))
    .accounts({
      user: walletPublicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const txSig = await signAndSendTransaction({ connection, provider, transaction: subscriptionTx, feePayer: walletPublicKey });
  const messagePayload = await fetchJson(`/api/activation-message?txSig=${encodeURIComponent(txSig)}`);
  const signature = await signActivationMessage(provider, messagePayload.message);
  const activation = await fetchJson("/api/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txSig, walletSignature: signature, leagues }),
  });

  return { txSig, activation };
}

async function ensureAssociatedTokenAccount({ connection, provider, owner, tokenMint, tokenAccount }) {
  const existing = await rpcCall(connection, (activeConnection) => activeConnection.getAccountInfo(tokenAccount, "confirmed"));
  if (existing) return;

  const transaction = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      owner,
      tokenAccount,
      owner,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  await signAndSendTransaction({ connection, provider, transaction, feePayer: owner });
}

async function signAndSendTransaction({ connection, provider, transaction, feePayer }) {
  const latestBlockhash = await rpcCall(connection, (activeConnection) => activeConnection.getLatestBlockhash("confirmed"));
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  const signed = await provider.signTransaction(transaction);
  const signature = await rpcCall(connection, (activeConnection) => activeConnection.sendRawTransaction(signed.serialize()));
  await rpcCall(connection, (activeConnection) => activeConnection.confirmTransaction({ signature, ...latestBlockhash }, "confirmed"));
  return signature;
}

async function firstHealthyConnection(rpcUrls) {
  const connection = fallbackConnection(rpcUrls);
  await rpcCall(connection, (activeConnection) => activeConnection.getLatestBlockhash("confirmed"));
  return connection;
}

function fallbackConnection(rpcUrls) {
  const endpoints = rpcUrls.map((url) => ({
    url,
    connection: new web3.Connection(url, "confirmed"),
  }));
  let activeIndex = 0;

  return {
    async call(task) {
      const failures = [];

      for (let attempt = 0; attempt < endpoints.length; attempt += 1) {
        const index = (activeIndex + attempt) % endpoints.length;
        const endpoint = endpoints[index];

        try {
          const result = await task(endpoint.connection);
          activeIndex = index;
          return result;
        } catch (error) {
          failures.push(`${hostFrom(endpoint.url)}: ${shortError(error)}`);
        }
      }

      throw new Error(`Solana RPC unavailable (${failures.join("; ")})`);
    },
  };
}

function rpcCall(connection, task) {
  return connection.call(task);
}

function rpcUrlsFrom(readiness) {
  const urls = Array.isArray(readiness.rpcUrls) && readiness.rpcUrls.length
    ? readiness.rpcUrls
    : [readiness.rpcUrl];
  return [...new Set(urls.filter(Boolean))];
}

function hostFrom(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function shortError(error) {
  const message = String(error?.message || error || "request failed");
  return message.replace(/\s+/g, " ").slice(0, 120);
}

async function signActivationMessage(provider, message) {
  const encoded = new TextEncoder().encode(message);
  const result = await provider.signMessage(encoded, "utf8");
  const signature = result?.signature || result;
  return bytesToBase64(signature);
}

function bytesToBase64(bytes) {
  const values = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  values.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(options?.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || `Request failed with ${response.status}`);
  }

  return payload;
}
