import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as networkHelpers from '@nomicfoundation/hardhat-network-helpers';
import * as helpers from './helpers';
import { numToUSD, numToWei } from './helpers';

const weiM = (n: number) => numToWei(n * 1_000_000);
const usdM = (n: number) => numToUSD(n * 1_000_000);

describe('Presale', function () {
  async function deploy() {
    const [owner, treasury, account1, account2, account3, account4] =
      await ethers.getSigners();

    const now = +(await networkHelpers.time.latest());

    const usdc = await ethers.deployContract('Token', ['USD Coin', 'USDC', 6]);
    const usdcAddr = await usdc.getAddress();

    const busd = await ethers.deployContract('Token', [
      'Binance USD',
      'BUSD',
      18,
    ]);
    const busdAddr = await busd.getAddress();

    // We start out not being open to the public
    const Presale = await ethers.getContractFactory('KercPresale');
    const presale = await Presale.deploy(
      treasury.address,
      [usdcAddr, busdAddr],
      2_500_000,
      3_500_000
    );
    const presaleAddr = await presale.getAddress();

    const seedAmount = helpers.numToUSD(10_000_000);
    await usdc.mintFor(account1.address, seedAmount);
    await usdc.mintFor(account2.address, seedAmount);
    await usdc.mintFor(account3.address, seedAmount);
    await busd.mintFor(account1.address, numToWei(10_000_00));

    return {
      presale,
      presaleAddr,
      usdc,
      usdcAddr,
      busd,
      busdAddr,
      owner,
      treasury,
      account1,
      account2,
      account3,
      account4,
      now,
    };
  }

  it('Can fetch raise tokens', async function () {
    const { presale, usdcAddr, busdAddr } = await loadFixture(deploy);
    expect(await presale.getTokens()).to.eql([usdcAddr, busdAddr]);
    expect(await presale.tokenDecimals(usdcAddr)).to.equal(6);
    expect(await presale.tokenDecimals(busdAddr)).to.equal(18);
  });

  it('Can update raise tokens', async function () {
    const { presale, usdcAddr, busdAddr } = await loadFixture(deploy);
    expect(await presale.getTokens()).to.eql([usdcAddr, busdAddr]);

    const frax = await ethers.deployContract('Token', ['Frax', 'FRAX', 18]);
    const fraxAddr = await frax.getAddress();

    await expect(presale.setTokens([fraxAddr])).to.not.be.reverted;
    expect(await presale.getTokens()).to.eql([fraxAddr]);
    expect(await presale.tokenDecimals(fraxAddr)).to.equal(18);
    expect(await presale.tokenDecimals(usdcAddr)).to.equal(0);
    expect(await presale.tokenDecimals(busdAddr)).to.equal(0);
  });

  it('Can update hard cap amount', async function () {
    const { presale, usdc, usdcAddr, account1, presaleAddr, now } =
      await loadFixture(deploy);

    expect(await presale.hardCapAmt()).to.equal(weiM(3.5));
    await expect(presale.setHardCapAmt(4_000_000)).to.not.be.reverted;
    expect(await presale.hardCapAmt()).to.equal(weiM(4));

    await presale.setTimes(now - 3600, now + 3600 * 24);
    await usdc.connect(account1).approve(presaleAddr, usdM(4));
    await expect(presale.connect(account1).participate(usdcAddr, usdM(4))).to
      .not.be.reverted;
    expect(await presale.balanceOf(account1.address)).to.equal(weiM(4));

    await expect(presale.setHardCapAmt(3_000_000)).to.be.reverted;
    await expect(presale.setHardCapAmt(4_100_000)).to.not.be.reverted;
    await expect(presale.setHardCapAmt(numToWei(5_000_000))).to.be.reverted;
  });

  it('Can update target amount', async function () {
    const { presale } = await loadFixture(deploy);

    expect(await presale.targetAmt()).to.equal(weiM(2.5));
    await expect(presale.setTargetAmt(3_000_000)).not.to.be.reverted;
    await expect(presale.setTargetAmt(numToWei(3_000_000))).to.be.reverted;
  });

  it('Can set hasEnded', async function () {
    const { presale } = await loadFixture(deploy);

    expect(await presale.hasEnded()).to.equal(false);
    await expect(presale.setHasEnded(true)).to.emit(presale, 'PresaleHasEnded');
    await expect(presale.setHasEnded(false)).to.emit(
      presale,
      'PresaleReopened'
    );
    await expect(presale.setHasEnded(false)).to.be.revertedWith(
      'ERR:HAS_ENDED_SAME'
    );
  });

  it('Correctly reports open status (non-deposit related)', async function () {
    const { presale, now } = await loadFixture(deploy);

    expect(await presale.open()).to.be.false;
    await expect(presale.setTimes(now - 3600, now + 3600 * 24)).not.to.be
      .reverted;
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 12);
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 25);
    expect(await presale.open()).to.be.false;
    await expect(presale.setEndTime(now + 3600 * 36)).not.to.be.reverted;
    expect(await presale.open()).to.be.true;
    await networkHelpers.time.increaseTo(now + 3600 * 37);
    expect(await presale.open()).to.be.false;
  });

  it('Can deposit using permit', async function () {
    const { presale, treasury, usdc, account1, now } = await loadFixture(
      deploy
    );

    await presale.setTimes(now - 3600, now + 3600 * 24);

    const amt = helpers.numToUSD(1_000);

    const { deadline, v, r, s } = await helpers.permit(
      usdc,
      await presale.getAddress(),
      account1,
      amt,
      now + 3600 * 12
    );
    const usdcAddr = await usdc.getAddress();

    // Valid permit
    await expect(
      presale
        .connect(account1)
        .participateWithPermit(usdcAddr, amt, deadline, v, r, s)
    ).to.not.be.reverted;

    // Invalid permit
    await expect(
      presale
        .connect(account1)
        .participateWithPermit(usdcAddr, amt, deadline, v, r, s)
    ).to.be.reverted;

    expect(await presale.balanceOf(account1.address)).to.equal(
      helpers.numToWei(1_000)
    );
    expect((await usdc.balanceOf(treasury.address)).toString()).to.equal(amt);
  });

  it('Handles multiple deposits correctly', async function () {
    const {
      presale,
      presaleAddr,
      treasury,
      usdc,
      usdcAddr,
      account1,
      account2,
      now,
    } = await loadFixture(deploy);

    await presale.setTimes(now - 3600, now + 3600 * 24);

    const amt1k = helpers.numToUSD(1_000);
    const amt2k = helpers.numToUSD(2_000);
    const amt3k = helpers.numToUSD(3_000);

    await usdc.connect(account1).approve(presaleAddr, amt2k);
    await usdc.connect(account2).approve(presaleAddr, amt1k);

    // double deposits of 1k to account1
    await expect(presale.connect(account1).participate(usdcAddr, amt1k)).to.not
      .be.reverted;
    expect(await presale.balanceOf(account1.address)).to.equal(
      helpers.numToWei(1_000)
    );
    await expect(presale.connect(account1).participate(usdcAddr, amt1k)).to.not
      .be.reverted;
    expect(await presale.balanceOf(account1.address)).to.equal(
      helpers.numToWei(2_000)
    );

    // deposit of 1k to account2
    await expect(presale.connect(account2).participate(usdcAddr, amt1k)).to.not
      .be.reverted;
    expect(await presale.balanceOf(account2.address)).to.equal(
      helpers.numToWei(1_000)
    );

    // 2k + 1k = 3k
    expect((await usdc.balanceOf(treasury.address)).toString()).to.equal(amt3k);

    expect(await presale.numberOfParticipants()).to.equal(2);
  });

  it('Fails if amount would go over hard cap', async function () {
    const { presale, presaleAddr, usdc, usdcAddr, account1, now } =
      await loadFixture(deploy);

    await presale.setTimes(now - 3600, now + 3600 * 24);

    await usdc
      .connect(account1)
      .approve(presaleAddr, helpers.numToUSD(10_000_000));

    await expect(
      presale
        .connect(account1)
        .participate(usdcAddr, helpers.numToUSD(4_000_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(
      presale
        .connect(account1)
        .participate(usdcAddr, helpers.numToUSD(3_400_000))
    ).to.not.be.rejected;
    await expect(
      presale.connect(account1).participate(usdcAddr, helpers.numToUSD(200_000))
    ).to.be.rejectedWith('ERR:AMT_TOO_BIG');
    await expect(
      presale.connect(account1).participate(usdcAddr, helpers.numToUSD(100_000))
    ).to.not.be.reverted;
    await expect(
      presale.connect(account1).participate(usdcAddr, 1)
    ).to.be.revertedWith('ERR:NOT_OPEN');
  });

  it('Can mix tokens with different amount of decimals', async function () {
    const {
      presale,
      presaleAddr,
      usdc,
      usdcAddr,
      busd,
      busdAddr,
      account1,
      now,
    } = await loadFixture(deploy);

    await presale.setTimes(now - 3600, now + 3600 * 24);

    const amt1k_usdc = helpers.numToUSD(1_000);
    const amt1k_busd = helpers.numToWei(1_000);
    const amt2k_result = helpers.numToWei(2_000);

    await usdc.connect(account1).approve(presaleAddr, amt1k_usdc);
    await busd.connect(account1).approve(presaleAddr, amt1k_busd);
    await expect(presale.connect(account1).participate(usdcAddr, amt1k_usdc)).to
      .not.be.rejected;

    // here
    await expect(presale.connect(account1).participate(busdAddr, amt1k_busd)).to
      .not.be.rejected;
    expect(await presale.balanceOf(account1.address)).to.equal(amt2k_result);
  });

  it('Fails on deposits with non-supported tokens', async function () {
    const { presale, presaleAddr, account1, now } = await loadFixture(deploy);

    await presale.setTimes(now - 3600, now + 3600 * 24);

    const usdm = await ethers.deployContract('Token', ['Moo Coin', 'USDM', 6]);
    const usdmAddr = await usdm.getAddress();

    const amt1k_usd = helpers.numToUSD(1_000);

    await usdm.connect(account1).approve(presaleAddr, amt1k_usd);
    await expect(
      presale.connect(account1).participate(usdmAddr, amt1k_usd)
    ).to.be.rejectedWith('ERR:NOT_VALID_TOKEN');
  });

  it('Can emergency withdraw token', async function () {
    const { presale, account1, presaleAddr, usdc, usdcAddr, treasury } =
      await loadFixture(deploy);

    await usdc.connect(account1).transfer(presaleAddr, numToUSD(500));
    expect(await usdc.balanceOf(treasury)).to.be.equal(0);
    await expect(presale.withdraw(usdcAddr)).not.to.be.reverted;
    expect(await usdc.balanceOf(treasury)).to.be.equal(numToUSD(500));
  });

  it('Can emergency withdraw ETH', async function () {
    const { presale, presaleAddr, treasury } = await loadFixture(deploy);

    const preBalance = await ethers.provider.getBalance(treasury);
    const fundEther = await ethers.deployContract('FundEther', [], {
      value: numToWei(100),
    });
    const fundEtherAddr = await fundEther.getAddress();
    expect(await ethers.provider.getBalance(fundEtherAddr)).to.equal(
      numToWei(100)
    );
    await expect(fundEther.destroy(presaleAddr)).to.not.be.reverted;
    expect(await ethers.provider.getBalance(presaleAddr)).to.equal(
      numToWei(100)
    );
    await expect(presale.withdrawETH()).to.not.be.reverted;
    expect(await ethers.provider.getBalance(treasury)).to.equal(
      preBalance + BigInt(numToWei(100))
    );
  });
});
