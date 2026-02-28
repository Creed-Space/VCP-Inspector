<div align="center">

# VCP Inspector

**Try the Value-Context Protocol in 30 seconds.**

### [https://inspector.valuecontextprotocol.org/](https://inspector.valuecontextprotocol.org/)

[![Live](https://img.shields.io/badge/live-inspector.valuecontextprotocol.org-blue?style=flat-square)](https://inspector.valuecontextprotocol.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

</div>

---

## What It Does

An interactive web tool for exploring the [Value-Context Protocol (VCP)](https://github.com/Creed-Space/VCP-Spec). Four tabs:

| Tab | Description |
|-----|-------------|
| **Decode** | Paste any VCP token — get a layer-by-layer breakdown with syntax highlighting |
| **Encode** | Build a CSM-1 token interactively with live preview |
| **Capability** | Simulate capability negotiation — select extensions, see VCP-Hello/VCP-Ack exchange |
| **Examples** | Pre-loaded tokens from real use cases drawn from the VCP spec |

## Tech Stack

- **SvelteKit** with static adapter (fully prerendered)
- **Tailwind CSS** for styling
- **Zero backend** — all VCP logic runs client-side in pure TypeScript
- **Deployed** on Vercel at [inspector.valuecontextprotocol.org](https://inspector.valuecontextprotocol.org/)

## Development

```bash
npm install
npm run dev
```

## Related

- [VCP Specification](https://github.com/Creed-Space/VCP-Spec) — The protocol spec (v3.1)
- [VCP SDK](https://github.com/Creed-Space/vcp-sdk) — Python, TypeScript, and Rust SDKs
- [Creed Space](https://creedspace.com) — The project behind VCP

## License

MIT

---

<div align="center">

A **[Creed Space](https://creedspace.com)** project.

</div>
