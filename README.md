# Soneium Swap Bot (Uniswap V4)

Bot Node.js untuk swap otomatis antara **USDSC**, **USDC.e**, dan **ETH native** di chain **Soneium** (chain id `1868`), lewat **Universal Router Uniswap V4**.

Token yang dipakai:
- USDSC: `0x3f99231dD03a9F0E7e3421c92B7b90fbe012985a`
- USDC.e: `0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369`
- Universal Router V4 (Soneium): `0x0e2850543f69f678257266e0907ff9a58b3f13de`

## Kenapa pakai Uniswap Trading API, bukan encode manual?

Uniswap V4 tidak punya alamat pool tunggal seperti V2/V3 — tiap pool diidentifikasi lewat kombinasi `fee`, `tickSpacing`, dan `hooks address` yang berbeda-beda per pasangan token, dan saya **tidak punya data pool yang terverifikasi** untuk USDSC/USDC.e/ETH di Soneium. Kalau parameter itu ditebak sembarangan, transaksi bisa terus revert atau (lebih parah) tereksekusi dengan slippage yang salah dan dana bisa rugi.

Karena itu bot ini memakai **Uniswap Trading API resmi** (`trade-api.gateway.uniswap.org`) — API yang sama dipakai app.uniswap.org — untuk mencari rute V4 terbaik secara otomatis dan membuat calldata transaksi yang sudah tervalidasi/simulasi duluan oleh Uniswap sebelum dikirim ke chain. Ini jauh lebih aman daripada encode manual dengan parameter yang belum terverifikasi.

## Persiapan

1. **Daftar API key Uniswap Trading API** (gratis): lihat https://docs.uniswap.org/api/trading/quick-start atau hub.uniswap.org untuk request API key.
2. Install dependency:
   ```bash
   npm install
   ```
3. Salin `.env.example` menjadi `.env`, lalu isi:
   ```bash
   cp .env.example .env
   ```
   - `PRIVATE_KEY` — private key wallet yang dipakai swap. **Jangan pernah dibagikan ke siapa pun atau di-commit ke git.**
   - `RPC_URL` — RPC Soneium (default publik sudah diisi, bisa diganti RPC privat biar lebih stabil).
   - `UNISWAP_API_KEY` — API key dari langkah 1.
   - `SLIPPAGE_START` / `SLIPPAGE_MAX` — bot mulai dari slippage serendah mungkin (default 0.05%) dan otomatis naik bertahap 0.05% kalau gagal, sampai batas maksimum, supaya tetap dapat slippage sekecil mungkin yang berhasil.
   - `CRON_SCHEDULE` — jadwal otomatis, default `0 0 * * *` (tiap hari jam 00:00, alias tiap 24 jam).

## Menjalankan

```bash
npm start
```

Menu yang akan muncul:

```
1. USDSC -> USDC.e
2. USDC.e -> USDSC
3. USDSC -> ETH (Soneium)
4. USDC.e -> ETH (Soneium)
5. ETH (Soneium) -> USDSC
```

Setelah pilih jenis swap, bot akan minta:
- **Jumlah per transaksi** (dalam satuan token, misal `10` untuk 10 USDSC)
- **Berapa kali transaksi diulang** setiap kali batch dijalankan
- **Mode jalan**: sekali saja, atau sekali + dijadwalkan otomatis tiap 24 jam pakai `node-cron`

Kalau pilih mode terjadwal, proses Node.js harus tetap hidup (jangan ditutup terminalnya). Untuk produksi, jalankan pakai process manager supaya tetap hidup di background dan auto-restart kalau crash, misalnya:

```bash
npm install -g pm2
pm2 start index.js --name soneium-swap-bot
pm2 save
```

## Cara kerja tiap swap

1. Cek desimal token in secara on-chain (bukan ditebak).
2. Kalau token in adalah ERC20 (bukan ETH native) dan allowance ke Permit2 belum cukup, bot kirim `approve()` tak terbatas dulu (sekali saja, swap berikutnya tidak perlu approve lagi).
3. Minta `/quote` ke Uniswap Trading API dengan slippage terendah yang dikonfigurasi.
4. Kalau quote perlu tanda tangan Permit2 (EIP-712), bot tanda tangani otomatis pakai private key wallet (tanpa transaksi on-chain terpisah, gratis gas).
5. Minta `/swap` untuk dapat calldata transaksi final, lalu kirim ke Universal Router.
6. Kalau gagal, slippage dinaikkan bertahap dan dicoba ulang sampai `SLIPPAGE_MAX`.

## Peringatan penting

- **Uji dengan jumlah kecil dulu** sebelum menjalankan otomatis dalam jumlah besar atau berulang.
- Pastikan wallet punya cukup **ETH untuk gas** di Soneium selain token yang mau di-swap.
- Private key disimpan di file `.env` lokal — pastikan file ini tidak pernah di-upload/commit ke repository publik. Tambahkan `.env` ke `.gitignore`.
- Bot ini bukan nasihat finansial. Likuiditas pool USDSC/USDC.e di Soneium bisa terbatas — selalu cek dulu harga & price impact di app.uniswap.org kalau ragu sebelum menjalankan otomatis dalam jumlah besar.
