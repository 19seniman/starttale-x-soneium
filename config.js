import 'dotenv/config';

// Chain Soneium mainnet
export const CHAIN_ID = 1868;

// Universal Router V4 resmi Uniswap di Soneium (verified, sumber: developers.uniswap.org)
export const UNIVERSAL_ROUTER = '0x0e2850543f69f678257266e0907ff9a58b3f13de';

// Permit2 (alamat sama di semua chain EVM)
export const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA';

// Alamat native ETH yang dipakai Uniswap Trading API
export const NATIVE_ETH = '0x0000000000000000000000000000000000000000';

// Token yang dipakai sesuai permintaan user
export const TOKENS = {
  USDSC: '0x3f99231dD03a9F0E7e3421c92B7b90fbe012985a',
  'USDC.e': '0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369',
  ETH: NATIVE_ETH,
};

export const UNISWAP_TRADE_API = 'https://trade-api.gateway.uniswap.org/v1';

export const ENV = {
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL || 'https://rpc.soneium.org',
  UNISWAP_API_KEY: process.env.UNISWAP_API_KEY,
  SLIPPAGE_START: parseFloat(process.env.SLIPPAGE_START || '0.05'),
  SLIPPAGE_MAX: parseFloat(process.env.SLIPPAGE_MAX || '1.0'),
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 0 * * *',
  DEBUG: process.env.DEBUG_UNISWAP === 'true',
};

export function validateEnv() {
  const missing = [];
  if (!ENV.PRIVATE_KEY) missing.push('PRIVATE_KEY');
  if (!ENV.UNISWAP_API_KEY) missing.push('UNISWAP_API_KEY');
  if (missing.length) {
    console.error(
      `\n[ERROR] Variabel .env belum diisi: ${missing.join(', ')}\n` +
        'Salin .env.example menjadi .env lalu isi nilainya sebelum menjalankan bot.\n'
    );
    process.exit(1);
  }
}
