import { Contract, MaxUint256 } from 'ethers';

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export function getErc20(address, signerOrProvider) {
  return new Contract(address, ERC20_ABI, signerOrProvider);
}

export async function getDecimals(tokenAddress, provider, nativeEthAddress) {
  if (tokenAddress.toLowerCase() === nativeEthAddress.toLowerCase()) return 18;
  const token = getErc20(tokenAddress, provider);
  return token.decimals();
}

export async function getBalance(tokenAddress, owner, provider, nativeEthAddress) {
  if (tokenAddress.toLowerCase() === nativeEthAddress.toLowerCase()) {
    return provider.getBalance(owner);
  }
  const token = getErc20(tokenAddress, provider);
  return token.balanceOf(owner);
}

/**
 * Pastikan allowance token ke Permit2 mencukupi. Kalau kurang, approve MaxUint256
 * sekali saja (approve tak terbatas) supaya swap berikutnya tidak perlu approve lagi.
 * Tidak berlaku untuk native ETH.
 */
export async function ensureAllowance({ tokenAddress, owner, spender, amount, wallet, nativeEthAddress }) {
  if (tokenAddress.toLowerCase() === nativeEthAddress.toLowerCase()) return null;

  const token = getErc20(tokenAddress, wallet);
  const current = await token.allowance(owner, spender);
  if (current >= amount) return null;

  console.log(`  -> Allowance kurang, mengirim approve() ke Permit2...`);
  const tx = await token.approve(spender, MaxUint256);
  const receipt = await tx.wait();
  console.log(`  -> Approve sukses. Tx: ${receipt.hash}`);
  return receipt;
}
