import { UNISWAP_TRADE_API, CHAIN_ID, ENV } from './config.js';

function headers(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': ENV.UNISWAP_API_KEY,
    ...extra,
  };
}

async function postJson(path, body, extraHeaders) {
  if (ENV.DEBUG) {
    console.log(`\n  [DEBUG] REQUEST ${path}:`, JSON.stringify(body, null, 2));
  }

  const res = await fetch(`${UNISWAP_TRADE_API}${path}`, {
    method: 'POST',
    headers: headers(extraHeaders),
    body: JSON.stringify(body),
  });
  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    // respons bukan JSON valid (misal HTML error page dari proxy/gateway)
    const err = new Error(
      `Uniswap API ${path} mengembalikan respons non-JSON (status ${res.status}). ` +
        `Cuplikan: ${rawText.slice(0, 300)}`
    );
    throw err;
  }

  if (ENV.DEBUG) {
    console.log(`  [DEBUG] RESPONSE ${path} (status ${res.status}):`, JSON.stringify(data, null, 2));
  }

  if (!res.ok) {
    const msg = data?.errorCode || data?.detail || data?.message || res.statusText;
    const err = new Error(`Uniswap API ${path} gagal (${res.status}): ${msg}`);
    err.raw = data;
    throw err;
  }
  return data;
}

/**
 * Minta quote untuk swap exact-input, khusus rute Uniswap V4.
 * slippageTolerance dalam persen, contoh 0.05 = 0.05%.
 */
export async function getQuote({ tokenIn, tokenOut, amountWei, swapper, slippageTolerance }) {
  return postJson('/quote', {
    type: 'EXACT_INPUT',
    tokenInChainId: CHAIN_ID,
    tokenOutChainId: CHAIN_ID,
    tokenIn,
    tokenOut,
    amount: amountWei.toString(),
    swapper,
    slippageTolerance,
    protocols: ['V4'],
    routingPreference: 'BEST_PRICE',
  });
}

/**
 * Bangun calldata transaksi swap dari hasil /quote.
 * Jika quote.permitData ada (butuh signature Permit2), sertakan signedPermit.
 */
export async function buildSwap({ quote, signedPermit }) {
  const body = { quote };
  if (signedPermit) body.signature = signedPermit;
  return postJson('/swap', body, { 'x-universal-router-version': '2.0' });
}
