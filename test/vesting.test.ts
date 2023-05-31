import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import Decimal from 'decimal.js';
import * as networkHelpers from '@nomicfoundation/hardhat-network-helpers';
import * as helpers from './helpers';

const monthInSeconds = 2628000;

describe('Vesting', function () {
  async function deploy() {
    const [owner, eco, op, res, multisig, account1] = await ethers.getSigners();

    const USDT = await ethers.getContractFactory('USDT');
    const usdt = await USDT.deploy();

    const Vesting = await ethers.getContractFactory('KercVesting');
    const vesting = await Vesting.deploy(multisig.address);

    const KERC = await ethers.getContractFactory('KERC');
    const kerc = await KERC.deploy(
      eco.address,
      op.address,
      res.address,
      vesting.address
    );

    const now = +(await networkHelpers.time.latest());

    return { owner, kerc, vesting, usdt, now, multisig, account1 };
  }

  it('Can update receiver', async function () {
    const { vesting, multisig, account1 } = await loadFixture(deploy);

    expect(await vesting.receiver()).to.equal(multisig.address);
    await expect(vesting.setReceiver(account1.address)).to.not.be.reverted;
    expect(await vesting.receiver()).to.equal(account1.address);
    await expect(vesting.setReceiver(ethers.constants.AddressZero)).to.be
      .reverted;
  });

  it("Doesn't allow start() to be re-run", async function () {
    const { kerc, vesting, account1 } = await loadFixture(deploy);

    const fiftyM = helpers.numToWei(50_000_000);

    await expect(
      vesting.connect(account1).start(kerc.address, fiftyM)
    ).to.be.revertedWith('ERR:NOT_OWNER');

    await expect(vesting.start(kerc.address, fiftyM)).to.be.revertedWith(
      'ERR:ALREADY_STARTED'
    );
  });

  it('Correctly starts at zero', async function () {
    const { vesting } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());

    expect(await vesting.startTime()).to.be.equal(now);
    expect(await vesting.vestedAmount()).to.be.equal(0);
    expect(await vesting.releasable()).to.be.equal(0);
    expect(await vesting.released()).to.be.equal(0);
  });

  it('Correctly calculates vesting payouts', async function () {
    const { vesting } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());
    const fiftyM = new Decimal(helpers.numToWei(50_000_000));

    // prettier-ignore
    const schedule = [
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,             // 1st year
        0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 1, 1, // 2nd year
        1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 3, 3, 3, 3, 3, 3, // 3rd year
        4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,             // 4th year
        4, 4, 4, 4,                                     // 5th year
    ];

    let pct = new Decimal(0);
    for (let i = 0; i < schedule.length; ++i) {
      pct = pct.plus(schedule[i]);

      await networkHelpers.time.increaseTo(now + monthInSeconds * (i + 1));
      expect(await vesting.vestedAmount()).to.be.equal(
        fiftyM.mul(pct.div(100)).toString()
      );
    }
  });

  it('Correctly calculates vested amount in 10 years', async function () {
    const { vesting } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());

    await networkHelpers.time.increaseTo(now + monthInSeconds * 12 * 10);
    expect(await vesting.vestedAmount()).to.be.equal(
      helpers.numToWei(50_000_000)
    );
  });

  it('Correctly receives vesting amount', async function () {
    const { kerc, vesting, multisig, account1 } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());
    await networkHelpers.time.increaseTo(now + monthInSeconds * 16.5);

    expect(await kerc.balanceOf(multisig.address)).to.be.equal(0);
    await expect(vesting.connect(account1).release()).to.not.be.reverted;
    expect(await kerc.balanceOf(multisig.address)).to.be.equal(
      helpers.numToWei(1_000_000)
    );
    await expect(vesting.connect(account1).release()).to.be.revertedWith(
      'ERR:NOTHING_TO_RELEASE'
    );
    expect(await kerc.balanceOf(multisig.address)).to.be.equal(
      helpers.numToWei(1_000_000)
    );
  });

  it('Allows emergency withdrawal', async function () {
    const { owner, vesting, usdt, account1 } = await loadFixture(deploy);

    const amt = 100 * 1e6;

    // Withdraw token
    await usdt.mint(vesting.address, amt);
    expect(await usdt.balanceOf(vesting.address)).to.be.equal(amt);
    await expect(vesting.emergencyWithdrawToken(usdt.address, account1.address))
      .to.not.be.reverted;
    expect(await usdt.balanceOf(vesting.address)).to.be.equal(0);
    expect(await usdt.balanceOf(account1.address)).to.be.equal(amt);

    // Withdraw ETH
    await owner.sendTransaction({
      to: vesting.address,
      value: amt,
    });
    expect(await ethers.provider.getBalance(vesting.address)).to.be.equal(amt);
    expect(await ethers.provider.getBalance(account1.address)).to.be.equal(
      helpers.numToWei(10_000)
    );
    await expect(vesting.emergencyWithdrawETH(account1.address)).to.not.be
      .reverted;
    expect(await ethers.provider.getBalance(account1.address)).to.be.equal(
      new Decimal(helpers.numToWei(10_000)).plus(amt).toString()
    );
  });

  it('Disallows emergency withdrawal of vesting token', async function () {
    const { now, kerc, vesting, account1 } = await loadFixture(deploy);

    await expect(
      vesting.emergencyWithdrawToken(kerc.address, account1.address)
    ).to.be.revertedWith('ERR:CANT_WITHDRAW_VESTING_TOKEN');

    // After vesting ends
    await networkHelpers.time.increaseTo(now + monthInSeconds * 53);

    await expect(vesting.emergencyWithdrawToken(kerc.address, account1.address))
      .to.not.be.reverted;
  });
});
