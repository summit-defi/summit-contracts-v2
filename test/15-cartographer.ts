import { BigNumber } from "@ethersproject/bignumber";
import { getNamedSigners } from "@nomiclabs/hardhat-ethers/dist/src/helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  consoleLog,
  ERR,
  EVENT,
  FIVETHOUSAND,
  mineBlockWithTimestamp,
  OASIS,
  PID,
  rolloverRound,
  TENTHOUSAND,
  TWOTHOUSAND,
  ZEROADD,
} from "../utils";
import { baseFixture } from "./fixtures_new";
import { Contracts } from "../utils";

let pid: BigNumber;

describe("Decaying withdrawal fee test:", function () {
  describe("owner function test", async function () {
    describe("setBaseMinimumWithdrawalFee function test", async function () {
      it("base minimum withdrawal fee update should be passed from owner", async function () {
        const { dev, cartographer } = await baseFixture();
        expect(await cartographer.baseMinimumWithdrawalFee()).to.be.equal(20);

        await cartographer.connect(dev).setBaseMinimumWithdrawalFee(30);
        expect(await cartographer.baseMinimumWithdrawalFee()).to.be.equal(30);
      });

      it("base minimum withdrawal fee update should be failed from not owner", async function () {
        const { exped, cartographer } = await baseFixture();
        await expect(
          cartographer.connect(exped).setBaseMinimumWithdrawalFee(30)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });

      it("base minimum withdrawal fee update should be failed with value smaller than 1%", async function () {
        const { dev, cartographer } = await baseFixture();
        await expect(
          cartographer.connect(dev).setBaseMinimumWithdrawalFee(9)
        ).to.be.revertedWith("Minimum fee outside 1%-10%");
      });

      it("base minimum withdrawal fee update should be failed with value bigger than 1%", async function () {
        const { dev, cartographer } = await baseFixture();
        await expect(
          cartographer.connect(dev).setBaseMinimumWithdrawalFee(101)
        ).to.be.revertedWith("Minimum fee outside 1%-10%");
      });
    });
    describe("setFeeDecayDuration function test", async function () {
      it("fee decay duration update should be passed from owner", async function () {
        const { dev, cartographer } = await baseFixture();
        expect(await cartographer.feeDecayDuration()).to.be.equal(864000);

        await cartographer.connect(dev).setFeeDecayDuration(20 * 86400);
        expect(await cartographer.feeDecayDuration()).to.be.equal(20 * 86400);
      });
      it("fee decay duration update should be failed from not owner", async function () {
        const { exped, cartographer } = await baseFixture();
        expect(await cartographer.feeDecayDuration()).to.be.equal(864000);

        await expect(
          cartographer.connect(exped).setFeeDecayDuration(20 * 86400)
        ).to.be.revertedWith("Ownable: caller is not the owner");
      });
    });
  });
});
