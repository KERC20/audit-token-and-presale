import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import Decimal from 'decimal.js';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { KercPresale, USDT } from '../typechain-types';
import * as helpers from './helpers';

Decimal.set({ toExpPos: 500, toExpNeg: -500 });

const ETH = new Decimal(1e18);
const USD = new Decimal(1e6);

function numToWei(n: number) {
  return ETH.mul(n).toString();
}

function numToUSD(n: number) {
  return USD.mul(n).toString();
}

type Fixture = {
  presale: KercPresale;
  usdt: USDT;
  owner: SignerWithAddress;
  treasury: SignerWithAddress;
  account1: SignerWithAddress;
  account2: SignerWithAddress;
  account3: SignerWithAddress;
  account4: SignerWithAddress;
  now: number;
};

describe('Presale', function () {
  async function deploy(): Promise<Fixture> {
    const [owner, treasury, account1, account2, account3, account4] =
      await ethers.getSigners();

    const USDT = await ethers.getContractFactory('USDT');
    const usdt = await USDT.deploy();

    // We start out not being open to the public
    const Presale = await ethers.getContractFactory('KercPresale');
    const presale = await Presale.deploy(
      treasury.address,
      usdt.address,
      2_500_000,
      0,
      0
    );

    const seedAmount = numToUSD(10_000_000);
    await usdt.mint(account1.address, seedAmount);
    await usdt.mint(account2.address, seedAmount);
    await usdt.mint(account3.address, seedAmount);

    const now = Math.floor(new Date().getTime() / 1000);
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
    await presale.setTimes(now - 3600, now + 600);
    expect(await presale.open()).to.be.true;
    await presale.setTimes(now + 3600, now + 7200);
    expect(await presale.open()).to.be.false;
    await presale.setTimes(now - 3600, now - 600);
    expect(await presale.open()).to.be.false;
    await presale.setEndTime(now + 600);
    expect(await presale.open()).to.be.true;
    await presale.setStartTime(now + 300);
    expect(await presale.open()).to.be.false;
    await presale.setStartTime(now - 300);
    expect(await presale.open()).to.be.true;
    await presale.setClosed(true);
    expect(await presale.open()).to.be.false;
    await presale.setClosed(false);
    expect(await presale.open()).to.be.true;
  });

  it('Can deposit using permit', async function () {
    const { presale, treasury, usdt, account1, now } = await loadFixture(
      deploy
    );

    await presale.setTimes(now - 3600, now + 3600);

    const amt = numToUSD(1_000);

    const { deadline, v, r, s } = await helpers.permit(
      usdt,
      presale.address,
      account1,
      amt
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

    await presale.setTimes(now - 3600, now + 3600);

    const amt1k = numToUSD(1_000);
    const amt2k = numToUSD(2_000);
    const amt3k = numToUSD(3_000);

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
  });

  it('Fails if amount would go over hard cap', async function () {
    const { presale, treasury, usdt, account1, now } = await loadFixture(
      deploy
    );

    await presale.setTimes(now - 3600, now + 3600);

    await usdt.connect(account1).approve(presale.address, numToUSD(10_000_000));

    // double deposits of 1k to account1
    await expect(
      presale.connect(account1).deposit(numToUSD(3_000_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(presale.connect(account1).deposit(numToUSD(2_400_000))).to.not
      .be.rejected;
    await expect(
      presale.connect(account1).deposit(numToUSD(200_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(presale.connect(account1).deposit(numToUSD(100_000))).to.not.be
      .reverted;
    await expect(presale.connect(account1).deposit(1)).to.be.revertedWith(
      'ERR:NOT_OPEN'
    );
  });
  it('Turns off when hard cap is reached', async function () {});
});
