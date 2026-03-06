---
title: 📋 Before You Begin
sidebar_position: 0
---

# Before You Begin

## What is a Digital Payment Credential?

A **Digital Payment Credential (DPC)** is a verifiable credential designed for card-based digital payments. It enables a payment processor to confirm that a consumer's wallet holds a valid payment instrument *before* initiating a transaction, reducing fraud and failed payments.

In this codelab you will explore the full DPC lifecycle using the **Multipaz SDK**. The codelab follows a **Read & Run** model: all code already exists in the SDK repository. You will read explanations of how each component works, then run the existing servers and wallet app to observe the behavior end-to-end. No new code is required.

---

## Prerequisites

* Familiarity with Android development and Kotlin
* Experience building apps in Android Studio
* Basic understanding of Verifiable Credentials and digital identity concepts
* Familiarity with server-side JVM applications (for running the issuer and verifier servers)

---

## What you'll learn

* How a DPC is **issued** from the issuer server to the wallet using OpenID4VCI
* The **credential structure**: six attributes that make up a DPC
* How the wallet **provisions and stores** a DPC, including device-key binding
* How the verifier performs a **DPC precheck** with five policy checks to determine payment eligibility
* How the **eligibility decision** is structured and returned

---

## What you'll need

* An Android device or emulator (API level 26 or higher)
* [Android Studio](https://developer.android.com/studio) (latest stable release)
* JDK 17 or higher (for running the issuer and verifier servers)
* The Multipaz SDK repository cloned locally
* Internet access for initial dependency resolution

---

## Libraries in this Codelab

| Module | Purpose |
| ------ | ------- |
| `multipaz-doctypes` | Document type definitions including the DPC credential structure |
| `multipaz-openid4vci-server` | Issuer server that mints and issues DPC credentials via OpenID4VCI |
| `multipaz-verifier-server` | Verifier server that performs DPC precheck with policy evaluation |
| `samples/testapp` | Wallet application that provisions, stores, and presents credentials |

---

## Project structure

You will work with three components that already exist in the SDK repository:

1. **Issuer Server** (`multipaz-openid4vci-server`)
   Issues DPC credentials to the wallet using the OpenID4VCI protocol.

2. **Wallet App** (`samples/testapp`)
   Receives, stores, and presents DPC credentials. Manages device-key binding and credential lifecycle.

3. **Verifier Server** (`multipaz-verifier-server`)
   Evaluates whether a presented DPC meets payment eligibility requirements through a five-check policy evaluation.

### End-to-end DPC lifecycle

```mermaid
flowchart LR
    Issuer["Issuer Server"]
    Wallet["Wallet App"]
    Verifier["Verifier Server"]
    Decision["Eligibility Decision\n(eligible / not)"]

    Issuer -- "1. Mints DPC credential\nvia OpenID4VCI" --> Wallet
    Wallet -- "2. Stores DPC\nwith device-key binding" --> Verifier
    Verifier -- "3. Runs 5 policy checks" --> Decision
```

Each section of this codelab covers one of these three components. You will start the relevant server or app, follow the steps to trigger the operation, and observe the results.
