# Security policy

## Supported versions

| Surface | Status |
|:---|:---|
| VCP Inspector 0.3.x, as deployed at inspector.valuecontextprotocol.org | Supported |
| Older Inspector releases | Not supported; reproduce against the current deployment |

Reports should name the affected surface and, where known, the commit hash.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use the repository's
[private vulnerability report](https://github.com/Creed-Space/VCP-Inspector/security/advisories/new)
form, or email
[security@creedspace.com](mailto:security@creedspace.com) if you cannot use
GitHub.

Include the affected component, impact, reproduction steps, a minimal proof of
concept where safe, and any proposed mitigation. Do not send live credentials,
personal data, or third-party secrets.

The coordinated severity, embargo, disclosure, and advisory process is
maintained in the public
[VCP-Spec security response](https://github.com/Creed-Space/VCP-Spec/blob/main/docs/SECURITY_RESPONSE.md),
which also sets the acknowledgment targets. Those targets are interim, not a
service-level agreement.

## Scope

The parsers and encoders (UVC tokens and `creed://` / `vcp://` URIs, CSM-1
codes, WC/AS welfare snapshots, Agent Runtime Profile artifacts), the capability
negotiation simulator, the deployed static site, and the package supply chain
are in scope. Parser crashes, hangs, or inputs that decode to a misleading
result count.

Defects in the protocol itself belong with
[VCP-Spec](https://github.com/Creed-Space/VCP-Spec); defects in the reference
implementations belong with [VCP-SDK](https://github.com/Creed-Space/VCP-SDK).

## Security posture

The Inspector has no backend. Everything you paste is parsed in your browser
and is not sent to a server. The deployed site loads Font Awesome from cdnjs
(with subresource integrity) and Vercel Analytics. It verifies no signatures
and makes no trust decisions, so a clean decode is not evidence that a token or
artifact is authentic.
