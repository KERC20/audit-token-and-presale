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
    const [owner, eco, op, res, acc1, acc2] = await ethers.getSigners();

    const kerc = await ethers.deployContract('KERC', [
      eco.address,
      op.address,
      res.address,
      acc1.address,
      acc2.address,
      210_000,
    ]);
    const kercAddr = await kerc.getAddress();

    return {
      kerc,
      kercAddr,
      owner,
      eco,
      op,
      res,
    };
  }

  it('Correctly mints tokens', async function () {
    const { kerc, eco, op, res } = await loadFixture(deploy);

    const [teamVesting, partnerVesting] = await Promise.all([
      await kerc.teamVesting(),
      await kerc.partnerVesting(),
    ]);

    expect(await kerc.balanceOf(eco.address)).to.be.equal(numToMillion(350));
    expect(await kerc.balanceOf(op.address)).to.be.equal(numToMillion(75));
    expect(await kerc.balanceOf(res.address)).to.be.equal(
      numToMillion(25 - 0.21)
    );
    expect(await kerc.balanceOf(teamVesting)).to.be.equal(numToMillion(50));
    expect(await kerc.balanceOf(partnerVesting)).to.be.equal(
      numToMillion(0.21)
    );
  });

  it('Can burn tokens', async function () {
    const { kerc, eco } = await loadFixture(deploy);

    expect(await kerc.connect(eco).burn(numToMillion(1))).to.not.be.reverted;
    expect(await kerc.totalSupply()).to.be.equal(numToMillion(499));
  });
});
