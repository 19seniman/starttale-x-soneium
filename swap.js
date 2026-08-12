import { parseUnits, formatUnits, isAddress } from 'ethers';
import { PERMIT2, NATIVE_ETH, ENV } from './config.js';
import { getDecimals, ensureAllowance } from './erc20.js';
import { getQuote, buildSwap } from './uniswapApi.js';

/**
 * Tanda tangan pesan Permit2 (EIP-712) yang diminta Uniswap API di quote.permitData,
 * supaya Universal Router boleh menarik token dari wallet tanpa approve on-chain tiap kali.
 */
async function signPermitIfNeeded(wallet, quote) {
  const permitData = quote.permitData;
  if (!permitData) return undefined;

  const { domain, types, values } = permitData;
  // Hapus field EIP712Domain kalau ada, ethers akan generate sendiri dari `domain`
  const cleanTypes = { ...types };
  delete cleanTypes.EIP712Domain;

  const signature = await wallet.signTypedData(domain, cleanTypes, values);
  return signature;
}

/**
 * Eksekusi satu kali swap exact-input dengan mekanisme:
 * 1. Ambil quote dengan slippage terendah (ENV.SLIPPAGE_START)
 * 2. Kalau quote/swap gagal (misal karena price impact / rute), naikkan slippage bertahap
 *    sampai batas ENV.SLIPPAGE_MAX, supaya tetap dapat slippage sekecil mungkin yang berhasil.
 */
export async function executeSwap({ wallet, provider, tokenInAddr, tokenOutAddr, amountHuman, label }) {
  const decimalsIn = await getDecimals(tokenInAddr, provider, NATIVE_ETH);
  const amountWei = parseUnits(amountHuman.toString(), decimalsIn);
  const owner = await wallet.getAddress();

  // Approve ke Permit2 dulu kalau token ERC20 (bukan native ETH) dan allowance kurang
  await ensureAllowance({
    tokenAddress: tokenInAddr,
    owner,
    spender: PERMIT2,
    amount: amountWei,
    wallet,
    nativeEthAddress: NATIVE_ETH,
  });

  let slippage = ENV.SLIPPAGE_START;
  let lastError;

  while (slippage <= ENV.SLIPPAGE_MAX) {
    try {
      console.log(`  -> [${label}] Minta quote (slippage ${slippage}%)...`);
      const quote = await getQuote({
        tokenIn: tokenInAddr,
        tokenOut: tokenOutAddr,
        amountWei,
        swapper: owner,
        slippageTolerance: slippage,
      });

      if (!quote.quote) {
        throw new Error(
          `Respons /quote tidak punya field "quote" seperti yang didokumentasikan. ` +
            `Jalankan dengan DEBUG_UNISWAP=true di .env untuk melihat respons mentahnya.`
        );
      }

      const signedPermit = await signPermitIfNeeded(wallet, quote);
      const swapBuild = await buildSwap({
        quote: quote.quote,
        signedPermit,
      });

      // Skema resmi: { requestId, swap: { to, from, data, value, gasLimit, ... }, gasFee }
      const txRequest = swapBuild.swap;
      if (!txRequest || !isAddress(txRequest.to) || typeof txRequest.data !== 'string') {
        throw new Error(
          `Respons /swap tidak berisi transaksi valid (field "swap.to"/"swap.data" hilang atau salah format). ` +
            `Jalankan dengan DEBUG_UNISWAP=true di .env untuk melihat respons mentah dari Uniswap API, ` +
            `lalu cek apakah ada perubahan skema. Respons ringkas: ${JSON.stringify(swapBuild).slice(0, 500)}`
        );
      }

      const tx = await wallet.sendTransaction({
        to: txRequest.to,
        data: txRequest.data,
        value: txRequest.value ? BigInt(txRequest.value) : 0n,
        gasLimit: txRequest.gasLimit ? BigInt(txRequest.gasLimit) : undefined,
      });

      console.log(`  -> Tx terkirim: ${tx.hash} (menunggu konfirmasi...)`);
      const receipt = await tx.wait();
      console.log(`  -> [${label}] SUKSES di block ${receipt.blockNumber}. Tx: ${receipt.hash}`);
      return receipt;
    } catch (err) {
      lastError = err;
      console.warn(`  -> Gagal dengan slippage ${slippage}%: ${err.message}`);
      slippage = Math.round((slippage + 0.05) * 100) / 100; // naikkan bertahap 0.05%
    }
  }

  throw new Error(
    `[${label}] Swap tetap gagal sampai slippage maksimum ${ENV.SLIPPAGE_MAX}%. Error terakhir: ${lastError?.message}`
  );
}

export function formatAmount(amount, decimals) {
  return formatUnits(amount, decimals);
}
