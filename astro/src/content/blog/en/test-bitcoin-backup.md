---
title: "How to test your Bitcoin backup safely"
summary: "Plan a recovery check, understand what it proves, and record the result while keeping control of your Bitcoin recovery secrets."
keyAnswer: "Use your wallet’s documented backup check or a separate compatible signing device. Confirm what the test proves, keep your working wallet available, and record the outcome without recording secrets."
locale: en
slug: how-to-test-your-bitcoin-backup-safely
author: Custody Consulting
publishedAt: 2026-11-10
draft: true
translationKey: test-bitcoin-backup
topics:
  - foundations
sources:
  - label: "Bitcoin Design: Bitcoin backups"
    url: https://bitcoin.design/guide/how-it-works/backups/
  - label: "BIP 39: Mnemonic code for generating deterministic keys"
    url: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
  - label: "BIP 380: Output Script Descriptors"
    url: https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki
  - label: "Trezor: Check wallet backup on Trezor Safe 5"
    url: https://trezor.io/guides/backups-recovery/general-standards/check-backup-on-trezor-safe-5
  - label: "BitBox: Hardware wallet backup methods"
    url: https://support.bitbox.swiss/en_US/hardware-wallet-backup-methods
---

A useful recovery check answers a specific question. Can you read your backup?
Does it match your signing device? Can you recover the intended wallet and use
it without the original device? Decide which question you need to answer
before starting.

This article focuses on on-chain wallets whose keys you control. For a
Lightning wallet, use its own recovery documentation because its backup
requirements depend on the implementation. Begin with the
[self-custody foundations](/en/blog/bitcoin-self-custody-foundations/) if you
are still deciding who should control the keys.

## What should a recovery test prove?

There are several levels of checking. Choose a level deliberately and describe
its limits in your notes.

| Check | What it can establish | What still needs checking |
| --- | --- | --- |
| Read the physical backup | The words or other backup material remain legible and accessible | Whether they recover the intended wallet |
| Use a documented device backup check | Whether that backup matches the material held by the device, within the feature’s scope | Separate passphrases, other backup copies and recovery on another device |
| Recover on a separate compatible signing device | Whether the chosen backup and configuration recreate the intended wallet | Whether all intended accounts and signing requirements have been tested |

For example, Trezor Safe 5 provides a backup check that compares entered backup
material with the device’s existing wallet backup. Follow the current
instructions for your exact model. A successful check has the scope described
by that feature. [Trezor backup-check documentation](https://trezor.io/guides/backups-recovery/general-standards/check-backup-on-trezor-safe-5).

## What information does your wallet need for recovery?

Identify the backup format, original wallet application, relevant accounts and
any optional passphrase. In BIP 39 wallets, a passphrase contributes to seed
generation. A different passphrase produces a different seed, so seeing an
empty wallet can be a reason to check your inputs and account configuration.
[BIP 39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).

Some setups also need information describing their addresses and spending
conditions. For multisig, this can include the signing threshold, cosigner
public keys and wallet descriptor. Preserve the wallet’s documented
configuration export. Descriptors describe scripts and key derivation, and
can contain sensitive information.
[BIP 380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki).

Keep instructions usable by the person expected to recover the wallet.
Explain where to find the required components, how to identify the correct
wallet and which documentation applies. Protect any record that reveals
addresses, balances or storage locations.
[Bitcoin Design’s backup guidance](https://bitcoin.design/guide/how-it-works/backups/).

## How do you prepare a controlled test?

Keep your working wallet available throughout the test. Avoid wiping your only
working signing device to discover whether its backup works. If you are
learning the recovery process, rehearse first with a separate practice wallet
that holds no savings.

Before using a funded wallet’s backup, read the procedure for the exact
device, backup format and application. Check which steps happen on the
signing device and which happen on the connected computer. For a cold-storage
hardware-wallet setup, choose a supported recovery method that keeps the
recovery secrets on the signing device.

Prepare a private workspace. Put away cameras and stop screen sharing.
Retrieve official documentation independently of messages or advertisements
offering recovery help. Keep recovery words and passphrases out of websites,
chat, email and consultation notes. A consultant can discuss your procedure
without receiving them.

Decide on a stopping point in advance. Stop if the device asks for an
unexpected action, the documented flow differs from what you see, or you
cannot explain which wallet you are checking. Resolve the uncertainty before
continuing.

## How do you interpret the result?

Suppose your device verifies a microSD backup successfully, but your recovery
plan depends on a handwritten copy and an optional passphrase. Those
components still need their own checks. BitBox explicitly distinguishes
between its backup check, written recovery words and passphrase verification.
[BitBox backup documentation](https://support.bitbox.swiss/en_US/hardware-wallet-backup-methods).

For a separate-device recovery, identify the intended account and compare
receiving addresses using the trusted display of the working device and the
recovered device’s own display. Use the same account, address type and
address index for the comparison. A mismatch is a reason to stop.

Matching addresses checks wallet reconstruction for those addresses. A
watch-only wallet can display addresses and balances without holding signing
keys. If your test needs to establish spending ability, include a separate,
deliberately planned signing check. A small on-chain transaction can incur
fees and reveal relationships between addresses. In multisig, one recovered
key alone does not demonstrate that the signing threshold can be met.

## What should you record and when should you repeat it?

Write a brief test record with:

- the date, device model and application version;
- the backup copy or component checked, using a private reference;
- the account and test scope, without copying secrets;
- the observed result and any unresolved discrepancy;
- the person responsible for the next review.

For example, record that a device backup check passed and that passphrase
recovery remains untested. This makes the next task clear.

Review the plan after changing a device, backup, passphrase, wallet
configuration or intended recovery person. Revisit it when moving stored
components or when your instructions become difficult to follow. Check the
manufacturer’s preparation requirements before firmware updates.

If you cannot identify the required components or define a controlled test,
a [custody review](/en/#services) can help you map the procedure and its gaps.
Bring questions and a description of your setup. Keep recovery secrets under
your own control throughout the consultation.
