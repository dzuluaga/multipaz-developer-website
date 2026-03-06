---
title: 🚀 Next Steps
sidebar_position: 4
---

# Next Steps

Congratulations! You have explored the full DPC (Digital Payment Credential) lifecycle using the Multipaz SDK.

---

## What you learned

In this codelab you explored three components that work together to enable DPC-based payment eligibility:

1. **Issuance**: How the issuer server creates a DPC credential with six attributes, binds it to the wallet's device key, and delivers it via OpenID4VCI
2. **Wallet**: How the testapp wallet provisions, stores, and displays DPC credentials using `SecureAreaBoundCredential` and `MdocCredential`
3. **Verification**: How the verifier server performs a DPC precheck with five policy checks (issuer trust, proof verification, assurance level, wallet binding, credential expiry) and returns an eligibility decision

---

## Troubleshooting

### Server unreachable during issuance

**Symptom**: The wallet cannot connect to the issuer server when requesting a credential.

**Solutions**:
- Verify the issuer server is running (`./gradlew :multipaz-openid4vci-server:run`)
- If using an Android emulator, use `10.0.2.2` instead of `localhost` to reach the host machine
- Check that the server port (default `8080`) is not blocked by a firewall
- Ensure no other process is using the same port

### Expired DPC credential

**Symptom**: The DPC precheck fails with `Credential expired on <date>`.

**Explanation**: DPC credentials have a 30-day validity window. If 30 days have passed since issuance, the credential expiry check will fail.

**Solution**: Issue a new DPC credential by repeating the issuance flow. The new credential will be valid for another 30 days.

### Issuer not in trust list

**Symptom**: The DPC precheck fails with `Issuer is not in trust list (<name>)`.

**Explanation**: The verifier maintains a trust list of known issuers. If the issuer's certificate is not in this list, the issuer trust check fails. This also causes the assurance level check to fail (since it requires a trusted issuer).

**Solution**: The verifier's trust list is configured in the server code. For testing, ensure you are using the default test certificates that ship with the SDK:
- "OWF Multipaz TestApp" - Test issuer certificate
- "Multipaz Test Issuer" - Payment credentials test issuer

If you modified the issuer's signing certificate, you need to add the new certificate to the verifier's trust list.

---

## Further resources

- [Multipaz SDK API Documentation](pathname:///kdocs/index.html) - Auto-generated API reference for the SDK
- [Utopia Wholesale Codelab](/codelabs) - Another codelab covering identity credential issuance and verification
- [Multipaz SDK Repository](https://github.com/openwallet-foundation/multipaz) - Source code for all components used in this codelab
- [OpenID4VCI Specification](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html) - The credential issuance protocol used by the issuer server
- [ISO/IEC 18013-5](https://www.iso.org/standard/69084.html) - The mdoc standard underlying the DPC credential format
