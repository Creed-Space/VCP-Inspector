<div align="center">

# VCP Inspector

**Try the Value Context Protocol in 30 seconds.**

### [https://inspector.valuecontextprotocol.org/](https://inspector.valuecontextprotocol.org/)

[![Live](https://img.shields.io/badge/live-inspector.valuecontextprotocol.org-blue?style=flat-square)](https://inspector.valuecontextprotocol.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

</div>

---

## What it does

An interactive web tool for exploring the [Value Context Protocol (VCP)](https://github.com/Creed-Space/VCP-Spec). Five tabs:

| Tab | Description |
|-----|-------------|
| **Decode** | Paste a UVC token (VCP/I) or a `creed://` / `vcp://` URI, a CSM-1 code (NANO, MICRO, or COMPACT), an experimental WC/AS welfare snapshot (VCP/S v2.1 lines, a 3.2 candidate), or an Agent Runtime Profile JSON artifact, and get a field-by-field breakdown with syntax highlighting |
| **Encode** | Build a CSM-1 code (NANO or MICRO tier) interactively with live preview |
| **Capability** | Simulate capability negotiation — select extensions, see the VCP-Hello/VCP-Ack exchange and each extension's status (Stable, Draft, or Experimental) |
| **Layers** | The I-T-S-A-M-E six-layer stack and which layers the Inspector covers |
| **Examples** | Illustrative tokens and codes drawn from the VCP spec's examples |

## Tech stack

- **SvelteKit** with static adapter (fully prerendered)
- **Tailwind CSS** for styling
- **Zero backend** — all VCP logic runs client-side in pure TypeScript
- **Deployed** on Vercel at [inspector.valuecontextprotocol.org](https://inspector.valuecontextprotocol.org/)

## Development

```bash
npm install
npm run dev
```

Run the standalone test, coverage, type, and build gates with:

```bash
npm run validate
```

An optional cross-repository gate reads the current SDK fixtures and Spec schemas directly. It does not affect standalone validation:

```bash
npm run test:interop -- --sdk-root ../VCP-SDK --spec-root ../VCP-Spec
```

`VCP_SDK_ROOT` and `VCP_SPEC_ROOT` provide equivalent path configuration.

## Security

Report suspected vulnerabilities privately, never in a public issue. See [SECURITY.md](./SECURITY.md).

## Related

- [VCP Specification](https://github.com/Creed-Space/VCP-Spec) — The protocol spec (v3.1 source baseline)
- [VCP SDK](https://github.com/Creed-Space/VCP-SDK) — Python and Rust implementations plus a TypeScript WebMCP browser integration (4.2.0, published)
- [Creed Space](https://creed.space) — The project behind VCP

## License

[MIT](./LICENSE)

---

<div align="center">

A **[Creed Space](https://creed.space)** project.

</div>
