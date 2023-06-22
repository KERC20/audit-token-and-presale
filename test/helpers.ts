import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import Decimal from 'decimal.js';
import { ethers } from 'hardhat';
import { ERC20Permit } from '../typechain-types';

Decimal.set({ toExpPos: 500, toExpNeg: -500 });

export const ETH = new Decimal(1e18);
export const USD = new Decimal(1e6);

export function numToWei(n: number) {
  return ETH.mul(n).toString();
}

export function numToUSD(n: number) {
  return USD.mul(n).toString();
}

export async function permit(
  token: ERC20Permit,
  spender: string,
  signer: SignerWithAddress,
  value: Decimal | string,
  now: number
) {
  const deadline = now + 600;
  const [nonce, name, network] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    signer.provider.getNetwork(),
  ]);

  const domain = {
    name,
    version: '1',
    chainId: network.chainId,
    verifyingContract: await token.getAddress()
  };
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  };
  const values = {
    owner: signer.address,
    spender,
    value: value.toString(),
    nonce,
    deadline,
  };
  const signature = await signer.signTypedData(domain, types, values);
  const sig = ethers.Signature.from(signature);

  return { deadline, v: sig.v, r: sig.r, s: sig.s };
}
