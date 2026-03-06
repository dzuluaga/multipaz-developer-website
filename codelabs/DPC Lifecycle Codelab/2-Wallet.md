---
title: 👛 Wallet
sidebar_position: 2
---

# Wallet

In this section you will explore how the testapp wallet provisions, stores, and displays DPC credentials. You will learn about device-key binding, credential lifecycle management, and the wallet APIs that handle these operations.

---

## Conceptual overview

After a DPC credential is issued (see [Issuance](./1-Issuance.md)), the wallet must securely store it and make it available for presentation to verifiers. The Multipaz SDK provides a layered credential management system:

- **`SecureAreaBoundCredential`** binds each credential to a hardware-backed or software-backed secure area, ensuring the device key cannot be extracted
- **`MdocCredential`** extends this with mdoc-specific storage (document type, issuer-signed data, MSO)
- **`DocumentModel`** provides a reactive API for observing and displaying stored credentials in the UI

---

## Credential storage

When a DPC arrives from the issuer, the wallet stores it as an `MdocCredential` bound to a `SecureArea`. The credential record includes:

| Property | Description |
| -------- | ----------- |
| `identifier` | Unique credential identifier within the wallet |
| `domain` | The domain context for this credential |
| `isCertified` | Whether the credential has been certified by the issuer |
| `validFrom` | Start of the credential's validity period |
| `validUntil` | End of the credential's validity period |
| `issuerProvidedData` | Raw bytes of the issuer-signed credential data |
| `usageCount` | Number of times the credential has been presented |

The credential viewer screen displays these properties:

```kotlin
// File: samples/testapp/src/commonMain/kotlin/org/multipaz/testapp/ui/
//       CredentialViewerScreen.kt, lines 55-73

if (credentialInfo == null) {
    Text("No credential for documentId $documentId credentialId $credentialId")
} else {
    KeyValuePairText("Class", credentialInfo.credential::class.simpleName.toString())
    KeyValuePairText("Identifier", credentialInfo.credential.identifier)
    KeyValuePairText("Domain", credentialInfo.credential.domain)
    KeyValuePairText("Certified", if (credentialInfo.credential.isCertified) "Yes" else "No")
    if (credentialInfo.credential.isCertified) {
        KeyValuePairText(
            "Valid From",
            formattedDateTime(credentialInfo.credential.validFrom)
        )
        KeyValuePairText(
            "Valid Until",
            formattedDateTime(credentialInfo.credential.validUntil)
        )
        KeyValuePairText(
            "Issuer provided data",
            "${credentialInfo.credential.issuerProvidedData.size} bytes"
        )
        KeyValuePairText("Usage Count", credentialInfo.credential.usageCount.toString())
    }
}
```

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-credential-details.png').default} alt="Credentials issued confirmation in the Provisioning Test screen" style={{width: '50%'}} />
  <p><em>The "Credentials issued" confirmation after a successful DPC provisioning flow</em></p>
</div>

---

## Device-key binding

Device-key binding is a critical security property of DPC credentials. When the issuer mints a credential, it embeds the wallet's **device public key** into the Mobile Security Object (MSO). This means:

- Only the device holding the corresponding private key can present the credential
- The verifier can verify that the presentation came from the authorized device
- Transferring the credential to another device is cryptographically prevented

The wallet accesses device-key information through `SecureAreaBoundCredential`:

```kotlin
// File: samples/testapp/src/commonMain/kotlin/org/multipaz/testapp/ui/
//       CredentialViewerScreen.kt, lines 107-123

if (credentialInfo.credential is SecureAreaBoundCredential) {
    KeyValuePairText(
        "Secure Area",
        (credentialInfo.credential as SecureAreaBoundCredential).secureArea.displayName
    )
    KeyValuePairText(
        "Secure Area Identifier",
        (credentialInfo.credential as SecureAreaBoundCredential).secureArea.identifier
    )
    KeyValuePairText(
        "Device Key Algorithm",
        credentialInfo.keyInfo!!.algorithm.description
    )
}
```

The `secureArea` property indicates whether the key is stored in hardware (e.g., Android Keystore with StrongBox) or software. On capable devices, hardware-backed storage provides the strongest protection against key extraction.

---

## Credential claims display

The wallet can display the individual claims (attributes) stored in a credential. For a DPC, these are the six attributes defined in the credential structure (issuer_name, payment_instrument_id, masked_account_reference, holder_name, issue_date, expiry_date).

The claims viewer iterates over all claims and renders each one:

```kotlin
// File: samples/testapp/src/commonMain/kotlin/org/multipaz/testapp/ui/
//       CredentialClaimsViewerScreen.kt, lines 44-57

if (credentialInfo == null) {
    Text("No credential for documentId ${documentId} credentialId ${credentialId}")
} else {
    for (claim in credentialInfo.claims) {
        Column(
            Modifier.fillMaxWidth()
        ) {
            Text(
                text = claim.displayName,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium,
            )
            RenderClaimValue(claim)
        }
    }
}
```

The `RenderClaimValue` composable handles rendering different claim types (strings, dates, etc.) with appropriate formatting.

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-credential-claims.png').default} alt="Issuer page showing Digital Payment Credential (SCA) with card preview" style={{width: '50%'}} />
  <p><em>The issuer page showing the Digital Payment Credential (SCA) offer with a card preview</em></p>
</div>

---

## Mdoc-specific properties

Since DPC credentials use the mdoc format, the wallet also stores and displays mdoc-specific data:

```kotlin
// File: samples/testapp/src/commonMain/kotlin/org/multipaz/testapp/ui/
//       CredentialViewerScreen.kt, lines 75-97

when (credentialInfo.credential) {
    is MdocCredential -> {
        val issuerSigned = Cbor.decode(
            credentialInfo.credential.issuerProvidedData.toByteArray()
        )
        val issuerAuth = issuerSigned["issuerAuth"].asCoseSign1
        val msoBytes = issuerAuth.payload!!
        KeyValuePairText("MSO size", "${msoBytes.size} bytes")
        KeyValuePairText(
            "ISO mdoc DocType",
            (credentialInfo.credential as MdocCredential).docType
        )
    }
}
```

Key mdoc properties include:
- **DocType**: The document type identifier (`org.multipaz.payment.sca.1` for DPC)
- **MSO (Mobile Security Object)**: Contains the value digests of all credential attributes, signed by the issuer. The verifier uses this to verify data integrity
- **DS Key Certificate**: The issuer's signing certificate chain, which the verifier validates against its trust list
- **Revocation status**: Checked via StatusList to determine if the credential has been revoked

---

<div style={{textAlign: 'center'}}>
  <img src={require('@site/static/img/dpc/dpc-credential-list.png').default} alt="Multipaz Sample Issuer showing available credentials including Digital Payment Credential (SCA)" style={{width: '50%'}} />
  <p><em>The Multipaz Sample Issuer listing all available credentials, with "Digital Payment Credential (SCA)" at the bottom</em></p>
</div>

## Exploring the wallet

To observe the wallet's credential management in action:

1. **View credentials**: After issuance, navigate to the credential list in the testapp. Tap a DPC credential to open the credential viewer
2. **Inspect properties**: Review the credential identifier, validity period, usage count, and certification status
3. **View claims**: Tap to view the individual DPC claims and see how each attribute is displayed
4. **Check device-key info**: Scroll to see the secure area name, identifier, and device key algorithm

In the next section, you will learn how the verifier uses a DPC presentation to perform a precheck and determine payment eligibility.
