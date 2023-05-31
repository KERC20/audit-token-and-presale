import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import Decimal from 'decimal.js';

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
    const [owner, eco, op, res, multisig, ...accounts] =
      await ethers.getSigners();

    const Vesting = await ethers.getContractFactory('KercVesting');
    const vesting = await Vesting.deploy(multisig.address);

    const KERC = await ethers.getContractFactory('KERC');
    const kerc = await KERC.deploy(
      eco.address,
      op.address,
      res.address,
      vesting.address
    );

    return {
      kerc,
      owner,
      eco,
      op,
      res,
      vesting,
      accounts,
    };
  }

  it('Correctly mints tokens', async function () {
    const { kerc, eco, op, res, vesting } = await loadFixture(deploy);

    expect(await kerc.balanceOf(eco.address)).to.be.equal(numToMillion(350));
    expect(await kerc.balanceOf(op.address)).to.be.equal(numToMillion(75));
    expect(await kerc.balanceOf(res.address)).to.be.equal(numToMillion(25));
    expect(await kerc.balanceOf(vesting.address)).to.be.equal(numToMillion(50));
  });

  it('Can burn tokens', async function () {
    const { kerc, eco } = await loadFixture(deploy);

    expect(await kerc.totalSupply()).to.be.equal(numToMillion(500));
    expect(await kerc.connect(eco).burn(numToMillion(1))).to.not.be.reverted;
    expect(await kerc.totalSupply()).to.be.equal(numToMillion(499));
  });
});
