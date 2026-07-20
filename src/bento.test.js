import assert from "node:assert/strict";
import test from "node:test";
import { extractEstimate, humanToWei, normalizeBentoLogin, weiToHuman } from "./bento.js";

test("converts human USDC amounts to Bento base units", () => {
  assert.equal(humanToWei("1"), "1000000000000000000");
  assert.equal(humanToWei("2.5"), "2500000000000000000");
  assert.equal(humanToWei("0.000000000000000001"), "1");
});

test("formats Bento base units for compact display", () => {
  assert.equal(weiToHuman("1000000000000000000"), "1");
  assert.equal(weiToHuman("1234500000000000000"), "1.2345");
});

test("normalizes Bento login token and managed account variants", () => {
  assert.deepEqual(
    normalizeBentoLogin({
      data: { token: "jwt" },
      account: { address: "0xmanaged" },
    }),
    {
      token: "jwt",
      managedAccount: "0xmanaged",
      raw: {
        data: { token: "jwt" },
        account: { address: "0xmanaged" },
      },
    },
  );
});

test("extracts quote fields from Bento estimate response variants", () => {
  assert.deepEqual(
    extractEstimate({
      success: true,
      estimate: {
        quote_id: "quote-1",
        shares_out: "2000000000000000000",
        min_shares_out: "1900000000000000000",
      },
    }),
    {
      success: true,
      quoteId: "quote-1",
      sharesOut: "2000000000000000000",
      minSharesOut: "1900000000000000000",
      raw: {
        success: true,
        estimate: {
          quote_id: "quote-1",
          shares_out: "2000000000000000000",
          min_shares_out: "1900000000000000000",
        },
      },
    },
  );
});
