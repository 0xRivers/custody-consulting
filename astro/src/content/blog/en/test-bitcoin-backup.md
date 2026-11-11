---
title: "How to test your Bitcoin backup safely"
summary: "Check what your Bitcoin backup can recover, prepare a test and record what worked while keeping your working wallet available."
keyAnswer: "Use your wallet’s documented backup check or recover on a separate compatible signing device. Keep the working wallet available and record exactly what you tested."
locale: en
slug: how-to-test-your-bitcoin-backup-safely
author: Custody Consulting
publishedAt: 2026-11-10
updatedAt: 2026-11-10
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

You have a backup. The next step is to find out whether you could use it.
Checking that you can read the words is a start. Recovering the intended wallet
on another device answers a different question. Choose what you want to check
before you begin, and keep your working wallet available throughout.

This guide covers on-chain wallets whose keys you control. For a Lightning
wallet, follow its own recovery documentation. If you are still deciding how
to manage your keys, start with the
[self-custody foundations](/en/blog/bitcoin-self-custody-foundations/).

## What will this test tell you?

A backup check can cover anything from reading a physical copy to recovering
and using a wallet. Record which check you performed so you know what still
needs attention.

| Check | What you learn | What it leaves open |
| --- | --- | --- |
| Read the physical backup | You can find and read the words or other backup material | Whether it recovers the intended wallet |
| Use your device’s documented backup check | Whether the backup matches the device, within that feature’s scope | Other copies, a separate passphrase and recovery on another device |
| Recover on a separate compatible signing device | Whether the backup and configuration recreate the intended wallet | Accounts and signing requirements you have yet to test |

For example, Trezor Safe 5 can compare an entered backup with the one held on
the device. Use the instructions for your exact model, and check what the
feature covers before interpreting the result.
[Trezor backup-check documentation](https://trezor.io/guides/backups-recovery/general-standards/check-backup-on-trezor-safe-5).

## What do you need to recover your wallet?

Check which backup format your wallet uses, which application created it and
which accounts you need to recover. If you use an optional passphrase, you
will need that too. In a BIP 39 wallet, a different passphrase produces a
different seed. If the recovered wallet looks empty, check the passphrase
and account configuration before drawing conclusions.
[BIP 39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).

Some wallets need additional configuration. For multisig, this can include
the required number of signatures, cosigner public keys and a wallet
descriptor. Keep the configuration export recommended by your wallet.
Descriptors describe how the wallet creates its addresses and spending
conditions, and may contain sensitive data.
[BIP 380](https://github.com/bitcoin/bips/blob/master/bip-0380.mediawiki).

Write instructions that the intended recovery person can follow. They need
to know where to find the components and how to identify the correct wallet.
Protect notes that reveal addresses, balances or storage locations.
[Bitcoin Design’s backup guidance](https://bitcoin.design/guide/how-it-works/backups/).

## How do you prepare the test?

Keep the working wallet available. Avoid resetting your only working signing
device just to find out whether its backup works. If you are learning the
process, first practise with a separate wallet that holds no savings.

Read the recovery instructions for your device, backup format and application
before handling a funded wallet’s backup. Work out which steps take place on
the signing device and which use the computer. For a hardware wallet used for
offline storage, choose a supported method that keeps recovery secrets on
the signing device.

Choose a private place to work. Put cameras away and stop screen sharing.
Open official documentation independently of messages or advertisements
offering recovery help. Keep recovery words and passphrases out of websites,
chat, email and consultation notes. You can ask for help with the procedure
while keeping those details private.

Stop if the device asks for an unexpected action, the instructions differ
from what you see or you are unsure which wallet you are checking. Find out
why before continuing.

## How do you check the result?

A successful microSD backup check may leave other parts of your plan untested.
If you expect to recover from a handwritten copy, check that copy too.
An optional passphrase also needs its own verification. BitBox explains
these limits in its backup documentation.
[BitBox backup documentation](https://support.bitbox.swiss/en_US/hardware-wallet-backup-methods).

When recovering on a separate device, compare receiving addresses on both
devices’ trusted displays. Use the same account, address type and address
index. Stop if the addresses differ.

Matching addresses shows that you have recreated those addresses. To check
spending ability, plan a separate signing test. A watch-only wallet can show
addresses and balances while holding no signing keys. With multisig, you
also need to check that you can meet the required number of signatures.
A small on-chain transaction can incur fees and reveal links between
addresses.

## What should you write down afterward?

Keep a short record of what you checked.

- Date, device model and application version.
- Backup copy or component checked, using a private reference.
- Account and test scope, excluding secrets.
- Result and any discrepancy you still need to investigate.
- Person responsible for the next review.

Be specific about the limits. For example, you might record that the device
backup check passed but passphrase recovery is still untested. That tells
you where to pick up next time.

Review the plan after changing a device, backup, passphrase or wallet
configuration, or changing who will recover it. Revisit the instructions
after moving stored components or finding a step difficult to follow.
Check the manufacturer’s preparation requirements before firmware updates.

If you are unsure which parts your test should cover, bring your questions
to a [custody review](/en/#services). We can work through your recovery
procedure while you keep control of the recovery secrets.
