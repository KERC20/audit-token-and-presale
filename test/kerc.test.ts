import { time, loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import Decimal from 'decimal.js';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { USDT } from '../typechain-types';

Decimal.set({ toExpPos: 500, toExpNeg: -500 });

const ETH = new Decimal(1e18);

function numToWei(n: number) {
  return ETH.mul(n).toString();
}

function numToMillion(n: number) {
  return ETH.mul(n).mul(1e6).toString();
}

describe('KERC', function () {
  async function deploy() {
    const [owner, eco, op, res, vest, ...accounts] = await ethers.getSigners();

    const KERC = await ethers.getContractFactory('KERC');
    const kerc = await KERC.deploy(
      eco.address,
      op.address,
      res.address,
      vest.address
    );

    return {
      kerc,
      owner,
      eco,
      op,
      res,
      vest,
      accounts,
    };
  }

  it('Correctly mints tokens', async function () {
    const { kerc, eco, op, res, vest } = await loadFixture(deploy);

    expect(await kerc.balanceOf(eco.address)).to.be.equal(numToMillion(350));
    expect(await kerc.balanceOf(op.address)).to.be.equal(numToMillion(75));
    expect(await kerc.balanceOf(res.address)).to.be.equal(numToMillion(25));
    expect(await kerc.balanceOf(vest.address)).to.be.equal(numToMillion(50));
  });

  it('Can burn tokens', async function () {
    const { kerc, eco } = await loadFixture(deploy);

    expect(await kerc.totalSupply()).to.be.equal(numToMillion(500));
    expect(await kerc.connect(eco).burn(numToMillion(1))).to.not.be.reverted;
    expect(await kerc.totalSupply()).to.be.equal(numToMillion(499));
  });
});
