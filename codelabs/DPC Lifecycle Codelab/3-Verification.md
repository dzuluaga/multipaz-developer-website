---
title: ✅ Verification
sidebar_position: 3
---

# Verification

In this section you will learn how the verifier server performs a DPC precheck to evaluate payment eligibility. You will explore the five policy checks, understand the eligibility decision structure, and run the precheck flow end-to-end.

---

## Conceptual overview

A **DPC precheck** allows a payment processor to verify that a consumer's wallet holds a valid DPC *before* initiating a payment transaction. The verifier requests a minimal credential presentation from the wallet and evaluates it against five policy checks. If all checks pass, the consumer is deemed eligible for the payment.

The precheck uses the **W3C Digital Credentials API** (`navigator.credentials.get()`) to request the credential from the wallet and return the presentation to the verifier.

---

## Running the verifier server

Navigate to the SDK repository root and start the verifier server:

```bash
./gradlew :multipaz-verifier-server:run
```

The server starts on `http://localhost:8082` by default. Open the verifier web UI in your browser.

---

## Triggering a DPC precheck

The precheck flow involves two server endpoints:

1. **`POST /verifier/dcPrecheckBegin`** - Initiates the precheck session
   - Creates an ephemeral session with a single-use reader key
   - Generates a Digital Credentials request for the `payment_sca_minimal` data elements
   - Returns a session ID and the request payload

2. **`POST /verifier/dcPrecheckGetData`** - Processes the wallet's response
   - Decrypts and parses the device response from the wallet
   - Verifies the device signature
   - Extracts the DPC document
   - Runs the five policy checks via `DpcPolicyEvaluator`
   - Returns the eligibility decision

To trigger a precheck:
1. Open the verifier web UI
2. Click the **DPC Precheck** button
3. The browser prompts the wallet to present the DPC credential
4. After presentation, the verifier evaluates the credential and displays the results

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-verifier-ui.png').default} alt="OWF Multipaz Verifier at localhost:8006 with Run DPC Precheck button" style={{width: '50%'}} />
  <p><em>The verifier web UI at localhost:8006 with the "Run DPC Precheck" button</em></p>
</div>

When the precheck begins, the browser prompts you to share the DPC credential:

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-share-dialog.png').default} alt="Share info dialog showing Ivan's Payment Card with all six DPC attribute values" style={{width: '50%'}} />
  <p><em>The share dialog showing "Ivan's Payment Card" with all six DPC attribute values (issuer_name, payment_instrument_id, masked_account_reference, holder_name, issue_date, expiry_date)</em></p>
</div>

---

## The 5 policy checks

The `DpcPolicyEvaluator` runs five sequential checks against the presented DPC credential. All five must pass for the consumer to be considered eligible.

| # | Check ID | Check Name | What It Validates | Example Failure Reason |
|---|----------|------------|-------------------|----------------------|
| 1 | `issuer_trust` | Issuer Trust List | Issuer certificate chain is in the verifier's trust list | `Issuer is not in trust list (Unknown)` |
| 2 | `proof_verification` | Proof/Device Response Verification | Cryptographic signature of the device response is valid | `Device response verification failed` |
| 3 | `assurance_level` | Assurance Level Policy | All mandatory claims are present and issuer is trusted | `Missing mandatory claims: holder_name, expiry_date` |
| 4 | `wallet_binding` | Wallet Binding Method | Device-signed authentication was successfully verified | `Device-signed authentication failed` |
| 5 | `credential_expiry` | Credential Expiry Validation | Credential expiry date is in the future | `Credential expired on 2026-01-15` |

The evaluator is implemented in `DpcPolicyEvaluator`:

```kotlin
// File: multipaz-verifier-server/src/main/java/org/multipaz/verifier/request/
//       DpcPolicyEvaluator.kt, lines 42-70

internal object DpcPolicyEvaluator {
    suspend fun evaluate(
        document: MdocDocument,
        trustManager: TrustManagerInterface,
        verificationSucceeded: Boolean,
    ): EligibilityDecision {
        val checks = mutableListOf<PolicyCheckResult>()
        val now = Clock.System.now()

        // 1. Issuer trust check
        val trustResult = trustManager.verify(document.issuerCertChain.certificates)
        checks.add(checkIssuerTrust(trustResult, document))

        // 2. Proof/device response verification
        checks.add(checkProofVerification(verificationSucceeded))

        // 3. Assurance level policy
        checks.add(checkAssuranceLevel(trustResult.isTrusted, document))

        // 4. Wallet binding method
        checks.add(checkWalletBinding(verificationSucceeded))

        // 5. Credential expiry
        checks.add(checkCredentialExpiry(document))

        return EligibilityDecision(
            eligible = checks.all { it.passed },
            checks = checks,
            evaluatedAt = now.toString(),
            expiresAt = (now + PRECHECK_DECISION_VALIDITY).toString(),
            credentialExpiryDate = credentialExpiryDate,
        )
    }
}
```

### Check 1: Issuer Trust

The verifier maintains a trust list of known issuers. This check validates the credential's issuer certificate chain against that list.

```kotlin
// File: multipaz-verifier-server/src/main/java/org/multipaz/verifier/request/
//       DpcPolicyEvaluator.kt, lines 72-96

private fun checkIssuerTrust(
    trustResult: TrustResult,
    document: MdocDocument,
): PolicyCheckResult {
    return if (trustResult.isTrusted) {
        val name = trustResult.trustPoints.firstOrNull()?.metadata?.displayName
            ?: "Unknown"
        PolicyCheckResult(
            checkId = "issuer_trust",
            checkName = "Issuer Trust List",
            passed = true,
            reason = "Issuer is in trust list ($name)"
        )
    } else {
        PolicyCheckResult(
            checkId = "issuer_trust",
            checkName = "Issuer Trust List",
            passed = false,
            reason = "Issuer is not in trust list ($name)"
        )
    }
}
```

### Check 2: Proof Verification

Verifies the cryptographic signature on the device response. This confirms that the credential presentation was not tampered with in transit.

### Check 3: Assurance Level

Checks that all mandatory claims are present in the credential:
- `issuer_name`
- `masked_account_reference`
- `holder_name`
- `issue_date`
- `expiry_date`

Also requires the issuer to be trusted (check 1 must pass). If claims are missing or the issuer is untrusted, this check fails.

```kotlin
// File: multipaz-verifier-server/src/main/java/org/multipaz/verifier/request/
//       DpcPolicyEvaluator.kt, lines 109-141

private fun checkAssuranceLevel(
    issuerTrusted: Boolean,
    document: MdocDocument,
): PolicyCheckResult {
    val namespace = DigitalPaymentCredential.CARD_NAMESPACE
    val issuerData = document.issuerNamespaces.data[namespace]
    val mandatoryClaims = listOf(
        "issuer_name",
        "masked_account_reference",
        "holder_name",
        "issue_date",
        "expiry_date",
    )
    val missingClaims = mandatoryClaims.filter { claim ->
        issuerData?.containsKey(claim) != true
    }

    return when {
        !issuerTrusted && missingClaims.isNotEmpty() -> PolicyCheckResult(
            checkId = "assurance_level",
            checkName = "Assurance Level Policy",
            passed = false,
            reason = "Issuer not trusted and missing mandatory claims: " +
                "${missingClaims.joinToString(", ")}"
        )
        !issuerTrusted -> PolicyCheckResult(
            checkId = "assurance_level",
            checkName = "Assurance Level Policy",
            passed = false,
            reason = "Issuer not trusted - cannot establish assurance level"
        )
        // ... additional cases for missing claims and success
    }
}
```

### Check 4: Wallet Binding

Verifies that the device-signed authentication succeeded. This confirms the credential was presented from the device it was originally issued to (the device holding the matching private key).

### Check 5: Credential Expiry

Extracts the `expiry_date` from the credential and compares it against the current UTC date:

```kotlin
// File: multipaz-verifier-server/src/main/java/org/multipaz/verifier/request/
//       DpcPolicyEvaluator.kt, lines 157-181

private fun checkCredentialExpiry(
    document: MdocDocument,
): PolicyCheckResult {
    val expiryDateStr = extractExpiryDate(document)
    if (expiryDateStr == null) {
        return PolicyCheckResult(
            checkId = "credential_expiry",
            checkName = "Credential Expiry Validation",
            passed = true,
            reason = "No expiry date in credential (non-expiring)"
        )
    }
    return try {
        val expiryDate = LocalDate.parse(expiryDateStr)
        val today = Clock.System.now()
            .toLocalDateTime(TimeZone.UTC).date
        if (expiryDate >= today) {
            PolicyCheckResult(
                checkId = "credential_expiry",
                checkName = "Credential Expiry Validation",
                passed = true,
                reason = "Credential expires on $expiryDate, valid"
            )
        } else {
            PolicyCheckResult(
                checkId = "credential_expiry",
                checkName = "Credential Expiry Validation",
                passed = false,
                reason = "Credential expired on $expiryDate"
            )
        }
    } catch (e: Throwable) { /* ... */ }
}
```

---

## Eligibility decision structure

After all five checks run, the evaluator returns an `EligibilityDecision`:

```kotlin
// File: multipaz-verifier-server/src/main/java/org/multipaz/verifier/request/
//       DpcPolicyEvaluator.kt, lines 28-35

@Serializable
data class EligibilityDecision(
    val eligible: Boolean,              // true only if ALL checks pass
    val checks: List<PolicyCheckResult>, // one result per check
    val evaluatedAt: String,            // ISO timestamp
    val expiresAt: String,              // evaluatedAt + 15 minutes
    val credentialExpiryDate: String?   // extracted from credential
)

@Serializable
data class PolicyCheckResult(
    val checkId: String,     // e.g., "issuer_trust"
    val checkName: String,   // e.g., "Issuer Trust List"
    val passed: Boolean,
    val reason: String       // human-readable explanation
)
```

Key properties:
- **`eligible`**: `true` only if every check passed. A single failure makes the consumer ineligible
- **`checks`**: The full list of five check results, each with a pass/fail status and reason
- **`expiresAt`**: The decision is valid for **15 minutes** after evaluation. After that, a new precheck must be performed
- **`credentialExpiryDate`**: The credential's own expiry date, extracted from the DPC attributes

---

## Observing results

When you trigger a DPC precheck in the verifier UI, the results modal shows:

- **Overall eligibility**: A clear eligible/not-eligible status
- **Individual check results**: Each of the five checks with its pass/fail status and reason
- **Decision validity**: When the decision was evaluated and when it expires

### Example: all checks pass

If the DPC is valid, issued by a trusted issuer, and presented from the correct device, all five checks pass and the decision is `eligible = true`.

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-precheck-result.png').default} alt="DPC Precheck Result showing Eligible with all 5 checks passed" style={{width: '50%'}} />
  <p><em>A successful DPC precheck: all five policy checks pass and the decision is "Eligible"</em></p>
</div>

### Example: expired credential

If the DPC's `expiry_date` is in the past, the credential expiry check fails:

```text
Check: Credential Expiry Validation
Status: FAILED
Reason: Credential expired on 2026-01-15
```

The overall decision becomes `eligible = false`, even if the other four checks pass. This demonstrates how a single policy failure blocks payment eligibility.

In the next section, you will find troubleshooting tips and resources for further learning.
