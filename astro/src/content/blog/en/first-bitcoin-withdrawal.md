---
title: "From Exchange to Hardware Wallet: Your First Bitcoin Withdrawal"
summary: "Make your first on-chain bitcoin withdrawal. Verify the receiving address on your hardware wallet, check the fee and confirm that a small test arrives."
keyAnswer: "Verify the receiving address on your hardware wallet, select the on-chain Bitcoin network at the exchange, and send a small test. Check that it confirms in your wallet before sending more."
locale: en
slug: first-bitcoin-withdrawal-to-hardware-wallet
author: Custody Consulting
publishedAt: 2026-11-26
draft: true
translationKey: first-bitcoin-withdrawal
topics:
  - foundations
sources:
  - label: "BitBox: Receive Bitcoin with the BitBoxApp and BitBox02"
    url: https://support.bitbox.swiss/basics-/receive-bitcoin-bitboxapp-bitbox02
  - label: "Trezor: Receive crypto in Trezor Suite"
    url: https://trezor.io/guides/sending-receiving-staking-funds/sending-receiving/receive-crypto-in-trezor-suite
  - label: "Bitcoin Design: Transactions"
    url: https://bitcoin.design/guide/how-it-works/transactions/
---

Your first withdrawal is a chance to practise the process with a small amount. You’ll use the exchange to send and your wallet app to check where the bitcoin arrived. This guide covers ordinary on-chain withdrawals to a hardware wallet you control.

## What should you check before withdrawing?

Set up the hardware wallet and make sure you can recover it. If you’re new to holding your own keys, start with the [self-custody foundations](/en/blog/bitcoin-self-custody-foundations/). If you already have a backup, use the [backup testing guide](/en/blog/how-to-test-your-bitcoin-backup-safely/) before relying on it for savings.

Check the exchange’s withdrawal minimum and fee, and look for the amount you’ll actually receive. Pick a test amount that meets the minimum and that you can afford to lose if you make a mistake. Budget for two withdrawal fees if you plan to send more afterward. The exchange needs your receiving address. Keep your recovery words, private keys and backup out of the withdrawal form and away from anyone offering support.

## How do you verify the receiving address?

Open the intended Bitcoin account in your wallet app and choose **Receive**. Use the app’s option to display the full address on your hardware wallet. On the exchange, choose **Withdraw**, select **BTC**, and select the on-chain **Bitcoin** network.

| Withdrawal option | When it fits |
| --- | --- |
| Bitcoin (on-chain) | You have a Bitcoin receiving address verified on your hardware wallet. |
| Lightning | You are making a Lightning payment and have a compatible Lightning payment request. |
| Token on another network | You intend to receive that token and have a wallet and address for its network. |

Paste the address into the exchange’s withdrawal form. Compare the complete address there with the one on the hardware wallet screen. Do the same if you scanned a QR code. Check the address again on the final review screen if the exchange shows it there. If any characters differ, or the exchange rejects the address format, stop and check the official instructions for your wallet and exchange before continuing.

## How do you send and check the test?

1. Enter the test amount and review the destination, network, fee and amount you expect to receive.
2. Confirm the withdrawal at the exchange. Keep the withdrawal reference and, once available, the transaction ID.
3. Open the same Bitcoin account in your wallet app and check for the incoming transaction. Compare the amount with the exchange’s record, accounting for any fee deducted from the withdrawal.
4. Wait until the transaction has at least one confirmation in your wallet before proceeding. A confirmation means it was included in a block. The exchange marking the withdrawal complete and the Bitcoin network confirming it are separate events.

If the transfer doesn’t appear, check whether the exchange has issued a transaction ID. A withdrawal still awaiting processing may not have been broadcast. If there’s an ID, compare the exchange’s transaction details with the account and address you verified, and check that your wallet app has synced. Resolve the discrepancy before submitting another withdrawal.

## What should you repeat when sending more?

Generate a fresh receiving address from the same account if your wallet offers one. A fresh address helps limit address reuse. Verify it on the device and repeat the network, address, amount and fee checks. The test shows that bitcoin reached the intended wallet on the first transfer. Use the backup guide separately to check that you can recover that wallet if your device becomes unavailable.

If you’d like help reviewing your withdrawal plan before moving a larger amount, see our [consultation services](/en/#services).
