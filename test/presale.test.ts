import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as helpers from './helpers';
import * as networkHelpers from '@nomicfoundation/hardhat-network-helpers';

describe('Presale', function () {
  async function deploy() {
    const [owner, treasury, account1, account2, account3, account4] =
      await ethers.getSigners();

    const now = +(await networkHelpers.time.latest());

    const USDT = await ethers.getContractFactory('USDT');
    const usdt = await USDT.deploy();

    // We start out not being open to the public
    const Presale = await ethers.getContractFactory('KercPresale');
    const presale = await Presale.deploy(
      treasury.address,
      usdt.address,
      2_500_000,
      now + 3600,
      now + 3600 * 24
    );

    const seedAmount = helpers.numToUSD(10_000_000);
    await usdt.mint(account1.address, seedAmount);
    await usdt.mint(account2.address, seedAmount);
    await usdt.mint(account3.address, seedAmount);

    return {
      presale,
      usdt,
      owner,
      treasury,
      account1,
      account2,
      account3,
      account4,
      now,
    };
  }

  it('Correctly reports open status (non-deposit related)', async function () {
    const { presale, now } = await loadFixture(deploy);

    expect(await presale.open()).to.be.false;
    await networkHelpers.time.increaseTo(now + 3600);
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 12);
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 25);
    expect(await presale.open()).to.be.false;
    await presale.setEndTime(now + 3600 * 36);
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 37);
    expect(await presale.open()).to.be.false;
  });

  it('Can deposit using permit', async function () {
    const { presale, treasury, usdt, account1, now } = await loadFixture(
      deploy
    );

    await networkHelpers.time.increaseTo(now + 3600 * 12);

    const amt = helpers.numToUSD(1_000);

    const { deadline, v, r, s } = await helpers.permit(
      usdt,
      presale.address,
      account1,
      amt,
      now + 3600 * 12
    );

    // Valid permit
    await expect(
      presale.connect(account1).depositWithPermit(amt, deadline, v, r, s)
    ).to.not.be.reverted;

    // Invalid permit
    await expect(
      presale.connect(account1).depositWithPermit(amt, deadline, v, r, s)
    ).to.be.reverted;

    expect(await presale.balances(account1.address)).to.equal(amt);
    expect((await usdt.balanceOf(treasury.address)).toString()).to.equal(amt);
  });

  it('Handles multiple deposits correctly', async function () {
    const { presale, treasury, usdt, account1, account2, now } =
      await loadFixture(deploy);

    await networkHelpers.time.increaseTo(now + 3600 * 12);

    const amt1k = helpers.numToUSD(1_000);
    const amt2k = helpers.numToUSD(2_000);
    const amt3k = helpers.numToUSD(3_000);

    await usdt.connect(account1).approve(presale.address, amt2k);
    await usdt.connect(account2).approve(presale.address, amt1k);

    // double deposits of 1k to account1
    await expect(presale.connect(account1).deposit(amt1k)).to.not.be.reverted;
    expect(await presale.balances(account1.address)).to.equal(amt1k);
    await expect(presale.connect(account1).deposit(amt1k)).to.not.be.reverted;
    expect(await presale.balances(account1.address)).to.equal(amt2k);

    // deposit of 1k to account2
    await expect(presale.connect(account2).deposit(amt1k)).to.not.be.reverted;
    expect(await presale.balances(account2.address)).to.equal(amt1k);

    // 2k + 1k = 3k
    expect((await usdt.balanceOf(treasury.address)).toString()).to.equal(amt3k);

    expect(await presale.numberOfDepositors()).to.equal(2);
  });

  it('Fails if amount would go over hard cap', async function () {
    const { presale, usdt, account1, now } = await loadFixture(deploy);

    await networkHelpers.time.increaseTo(now + 3600 * 12);

    await usdt
      .connect(account1)
      .approve(presale.address, helpers.numToUSD(10_000_000));

    // double deposits of 1k to account1
    await expect(
      presale.connect(account1).deposit(helpers.numToUSD(3_000_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(presale.connect(account1).deposit(helpers.numToUSD(2_400_000)))
      .to.not.be.rejected;
    await expect(
      presale.connect(account1).deposit(helpers.numToUSD(200_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(presale.connect(account1).deposit(helpers.numToUSD(100_000)))
      .to.not.be.reverted;
    await expect(presale.connect(account1).deposit(1)).to.be.revertedWith(
      'ERR:NOT_OPEN'
    );
  });
});
