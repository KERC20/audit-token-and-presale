import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import Decimal from 'decimal.js';
import * as networkHelpers from '@nomicfoundation/hardhat-network-helpers';
import * as helpers from './helpers';

const monthInSeconds = 2628000;

describe('Vesting', function () {
  async function deploy() {
    const [owner, eco, op, res, vTeam, vPartner, ...accounts] =
      await ethers.getSigners();

    const usdc = await ethers.deployContract('Token', ['USD Coin', 'USDC', 6]);
    const usdcAddr = await usdc.getAddress();

    const kerc = await ethers.deployContract('KERC', [
      eco.address,
      op.address,
      res.address,
      vTeam.address,
      vPartner.address,
      210_000, // 6% of 3.5M
    ]);
    const kercAddr = await kerc.getAddress();
    const teamVesting = await ethers.getContractAt(
      'KercVesting',
      await kerc.teamVesting()
    );

    const now = +(await networkHelpers.time.latest());

    return {
      owner,
      kerc,
      kercAddr,
      teamVesting,
      usdc,
      usdcAddr,
      now,
      vTeam,
      accounts,
    };
  }

  it('Correctly starts at zero', async function () {
    const { teamVesting } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());

    expect(await teamVesting.startTime()).to.be.equal(now);
    expect(await teamVesting.vestedAmount()).to.be.equal(0);
    expect(await teamVesting.releasable()).to.be.equal(0);
    expect(await teamVesting.released()).to.be.equal(0);
  });

  it('Correctly calculates vesting payouts', async function () {
    const { teamVesting } = await loadFixture(deploy);

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
      expect(await teamVesting.vestedAmount()).to.be.equal(
        fiftyM.mul(pct.div(100)).toString()
      );
    }
  });

  it('Correctly calculates vested amount in 10 years', async function () {
    const { teamVesting } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());

    await networkHelpers.time.increaseTo(now + monthInSeconds * 12 * 10);
    expect(await teamVesting.vestedAmount()).to.be.equal(
      helpers.numToWei(50_000_000)
    );
  });

  it('Correctly receives vesting amount', async function () {
    const { kerc, teamVesting, vTeam } = await loadFixture(deploy);

    const now = +(await networkHelpers.time.latest());
    await networkHelpers.time.increaseTo(now + monthInSeconds * 16.5);

    expect(await kerc.balanceOf(vTeam.address)).to.be.equal(0);
    await expect(teamVesting.connect(vTeam).release()).to.not.be.reverted;
    expect(await kerc.balanceOf(vTeam.address)).to.be.equal(
      helpers.numToWei(1_000_000)
    );
    await expect(teamVesting.connect(vTeam).release()).to.be.revertedWith(
      'ERR:NOTHING_TO_RELEASE'
    );
    expect(await kerc.balanceOf(vTeam.address)).to.be.equal(
      helpers.numToWei(1_000_000)
    );
  });

  it('Allows emergency withdrawal', async function () {
    const {
      owner,
      teamVesting,
      usdc,
      usdcAddr,
      vTeam,
      accounts: [account1],
    } = await loadFixture(deploy);

    const amt = 100 * 1e6;

    // Withdraw token
    const vestingAddr = await teamVesting.getAddress();
    await usdc.mint(vestingAddr, amt);
    expect(await usdc.balanceOf(vestingAddr)).to.be.equal(amt);
    await expect(
      teamVesting
        .connect(vTeam)
        .emergencyWithdrawToken(usdcAddr, account1.address)
    ).to.not.be.reverted;
    expect(await usdc.balanceOf(vestingAddr)).to.be.equal(0);
    expect(await usdc.balanceOf(account1.address)).to.be.equal(amt);

    // Withdraw ETH
    await owner.sendTransaction({
      to: vestingAddr,
      value: amt,
    });
    expect(await ethers.provider.getBalance(vestingAddr)).to.be.equal(amt);
    expect(await ethers.provider.getBalance(account1.address)).to.be.equal(
      helpers.numToWei(10_000)
    );
    await expect(
      teamVesting.connect(vTeam).emergencyWithdrawETH(account1.address)
    ).to.not.be.reverted;
    expect(await ethers.provider.getBalance(account1.address)).to.be.equal(
      new Decimal(helpers.numToWei(10_000)).plus(amt).toString()
    );
  });

  it('Disallows emergency withdrawal of vesting token', async function () {
    const {
      now,
      kercAddr,
      teamVesting,
      vTeam,
      accounts: [account1],
    } = await loadFixture(deploy);

    await expect(
      teamVesting
        .connect(vTeam)
        .emergencyWithdrawToken(kercAddr, account1.address)
    ).to.be.revertedWith('ERR:CANT_WITHDRAW_VESTING_TOKEN');

    // After vesting ends
    await networkHelpers.time.increaseTo(now + monthInSeconds * 53);

    await expect(
      teamVesting
        .connect(vTeam)
        .emergencyWithdrawToken(kercAddr, account1.address)
    ).to.not.be.reverted;
  });
});
