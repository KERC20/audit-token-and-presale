import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import Decimal from 'decimal.js';
import hre from 'hardhat';
import { ERC20Permit } from '../typechain-types';

export async function permit(
  token: ERC20Permit,
  spender: string,
  signer: SignerWithAddress,
  value: Decimal | string
) {
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const [nonce, name, chainId] = await Promise.all([
    token.nonces(signer.address),
    token.name(),
    signer.getChainId(),
  ]);

  const domain = {
    name,
    version: '1',
    chainId,
    verifyingContract: token.address,
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
  const signature = await signer._signTypedData(domain, types, values);
  const sig = hre.ethers.utils.splitSignature(signature);

  return { deadline, ...sig };
}
