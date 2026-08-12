import inquirer from 'inquirer';
import cron from 'node-cron';
import { JsonRpcProvider, Wallet } from 'ethers';
import { ENV, TOKENS, CHAIN_ID, validateEnv } from './config.js';
import { executeSwap } from './swap.js';

validateEnv();

const provider = new JsonRpcProvider(ENV.RPC_URL, CHAIN_ID);
const wallet = new Wallet(ENV.PRIVATE_KEY, provider);

const SWAP_MENU = {
  1: { label: 'USDSC -> USDC.e', tokenIn: TOKENS.USDSC, tokenOut: TOKENS['USDC.e'] },
  2: { label: 'USDC.e -> USDSC', tokenIn: TOKENS['USDC.e'], tokenOut: TOKENS.USDSC },
  3: { label: 'USDSC -> ETH (Soneium)', tokenIn: TOKENS.USDSC, tokenOut: TOKENS.ETH },
  4: { label: 'USDC.e -> ETH (Soneium)', tokenIn: TOKENS['USDC.e'], tokenOut: TOKENS.ETH },
  5: { label: 'ETH (Soneium) -> USDSC', tokenIn: TOKENS.ETH, tokenOut: TOKENS.USDSC },
};

async function runBatch({ menuChoice, amount, repeatCount }) {
  const opt = SWAP_MENU[menuChoice];
  console.log(`\n=== Menjalankan ${repeatCount}x swap: ${opt.label}, jumlah ${amount} per transaksi ===`);

  for (let i = 1; i <= repeatCount; i++) {
    console.log(`\n[${i}/${repeatCount}] ${opt.label}`);
    try {
      await executeSwap({
        wallet,
        provider,
        tokenInAddr: opt.tokenIn,
        tokenOutAddr: opt.tokenOut,
        amountHuman: amount,
        label: `${opt.label} #${i}`,
      });
    } catch (err) {
      console.error(`  -> [GAGAL] ${err.message}`);
      // Lanjut ke transaksi berikutnya walau satu gagal, supaya batch tidak berhenti total
    }
  }
  console.log('\n=== Batch selesai ===\n');
}

async function mainMenu() {
  console.log('==========================================');
  console.log(' Soneium Swap Bot - Uniswap V4 (USDSC / USDC.e / ETH)');
  console.log(` Wallet: ${await wallet.getAddress()}`);
  console.log('==========================================');

  const { menuChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'menuChoice',
      message: 'Pilih jenis swap:',
      choices: Object.entries(SWAP_MENU).map(([key, v]) => ({ name: `${key}. ${v.label}`, value: key })),
    },
  ]);

  const { amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'amount',
      message: `Jumlah per transaksi (${SWAP_MENU[menuChoice].label.split(' -> ')[0]}):`,
      validate: (v) => (!isNaN(parseFloat(v)) && parseFloat(v) > 0) || 'Masukkan angka lebih besar dari 0',
    },
  ]);

  const { repeatCount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repeatCount',
      message: 'Berapa kali transaksi ini diulang setiap kali dijalankan?',
      default: '1',
      validate: (v) => (Number.isInteger(Number(v)) && Number(v) > 0) || 'Masukkan bilangan bulat lebih besar dari 0',
    },
  ]);

  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Mode jalan:',
      choices: [
        { name: 'Jalankan sekali sekarang', value: 'once' },
        { name: `Jalankan sekarang + jadwalkan otomatis tiap 24 jam (cron: ${ENV.CRON_SCHEDULE})`, value: 'cron' },
      ],
    },
  ]);

  const params = { menuChoice, amount: parseFloat(amount), repeatCount: Number(repeatCount) };

  await runBatch(params);

  if (mode === 'cron') {
    console.log(`\nBot dijadwalkan otomatis dengan cron pattern "${ENV.CRON_SCHEDULE}" (default: tiap 24 jam sekali).`);
    console.log('Biarkan proses ini tetap berjalan (misalnya lewat pm2 / screen / tmux) agar jadwal tetap aktif.\n');
    cron.schedule(ENV.CRON_SCHEDULE, () => {
      console.log(`\n[CRON] Trigger otomatis pada ${new Date().toISOString()}`);
      runBatch(params).catch((err) => console.error('[CRON] Batch gagal total:', err.message));
    });
  } else {
    process.exit(0);
  }
}

mainMenu().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
