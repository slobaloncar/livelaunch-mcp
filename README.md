# LiveLaunch MCP

Remote MCP server for [LiveLaunch](https://livelaunch.vercel.app), a Solana token launchpad on [Meteora Dynamic Bonding Curve](https://livelaunch.vercel.app). Tokens graduate to Meteora DAMM v2.

This repository holds **connection info and docs only**. It does not contain the LiveLaunch app, private keys, or API secrets. The live server runs at the URL below.

## Connect

| | |
| --- | --- |
| Endpoint | `https://livelaunch.vercel.app/mcp` |
| Transport | Streamable HTTP, stateless |
| Auth | None. No API key. |
| Protocol | MCP (`2025-06-18` advertised; also `2025-11-25`, `2025-03-26`) |

Discovery files on the live site:

- [Agents guide](https://livelaunch.vercel.app/agents)
- [REST docs](https://livelaunch.vercel.app/developers)
- [OpenAPI](https://livelaunch.vercel.app/openapi.json)
- [llms.txt](https://livelaunch.vercel.app/llms.txt)
- [MCP server card](https://livelaunch.vercel.app/mcp/server-card)
- [`.well-known/mcp.json`](https://livelaunch.vercel.app/.well-known/mcp.json)

### Cursor, Claude Desktop, VS Code

Cursor:

```json
{
  "mcpServers": {
    "livelaunch": {
      "url": "https://livelaunch.vercel.app/mcp"
    }
  }
}
```

Claude Desktop / clients that want an explicit HTTP type:

```json
{
  "mcpServers": {
    "livelaunch": {
      "type": "http",
      "url": "https://livelaunch.vercel.app/mcp"
    }
  }
}
```

Copies of these configs are in [`examples/`](./examples).

### stdio fallback

If a client only speaks stdio, use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```bash
npx mcp-remote https://livelaunch.vercel.app/mcp
```

```json
{
  "mcpServers": {
    "livelaunch": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://livelaunch.vercel.app/mcp"]
    }
  }
}
```

### DeepSeek Harness

LiveLaunch is a remote MCP server. In [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) there is no separate `mcp.json` for the official client: each server is one `@deepseek-ai/dsh-mcp-client` row in the profile patch.

1. Install the official MCP client into your profile. Pin it to your `dsh` version — the npm `latest` tag can lag behind the harness:

```bash
dsh --version
dsh plugin --profile web add @deepseek-ai/dsh-mcp-client@<your-dsh-version>
```

2. Add this to `~/.dsh/cordis.patch.yml` (or the project's `.dsh/cordis.patch.yml`). A copy lives at [`cordis.patch.yml`](./cordis.patch.yml):

```yaml
- insert:
    - id: mcp-livelaunch
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: livelaunch
        transport: streamable-http
        url: https://livelaunch.vercel.app/mcp
        failOnStartupError: false
```

3. Restart `dsh web` (or your profile). Tools appear as `mcp__livelaunch__*`. Confirm the row with `dsh --profile web --dump-config`. Swap `web` for your profile name if you use another one.

This repository is also a config-only DSH bundle (`dsh.bundle` in `package.json`). After the official MCP client is installed in the profile, you can add the same row with:

```bash
dsh plugin --profile web add github:slobaloncar/livelaunch-mcp
```

There is no build script, so a GitHub install does not need a `prepare` allowlist. LiveLaunch never takes a private key; transaction tools return unsigned transactions only.

## Tools

Nine tools, taken from a live `tools/list` on 24 November 2026 (Europe/Sarajevo, UTC+1). Read tools return data only. The `build_*` tools return an **unsigned** transaction; they do not broadcast.

| Tool | Title | Kind | Description |
| --- | --- | --- | --- |
| `get_health` | Health | Read | API and Solana RPC health: slot, version, and the LiveLaunch config addresses. No transaction is built. |
| `list_tokens` | List tokens | Read | List LiveLaunch tokens. Each row includes mint, pool, price, market cap, curve progress, `currentFeeBps`, and `protectionEndsAt` (null when that token has no launch protection). Optional: `limit`, `cursor`, `creator`, `sort`. |
| `get_token` | Get token | Read | One LiveLaunch token: price, market cap, curve progress, current fee, launch protection, creator links, and unclaimed creator fees. Read `currentFeeBps` and `protectionEndsAt` before trading. Required: `mint`. |
| `get_fees` | Fee schedule | Read | Fee model for new launches, including the current fee, launch protection, and the Meteora / creator / platform split. For a specific token, use `get_token`. |
| `get_quote` | Quote buy or sell | Read | Quote a buy (amount is SOL) or a sell (amount is tokens). Returns `expectedOut`, `minOut`, the pool fee, and `poolFee.protectionEndsAt`. Does not build or send a transaction. Required: `mint`, `side`. |
| `build_launch_tx` | Build launch transaction | Unsigned tx | Build an unsigned launch transaction (token, metadata, Meteora bonding-curve pool, optional creator first buy). Pass `mint` as the public key of a keypair you generated and also sign with that keypair. If `mint` is omitted the server generates one and pre-signs only that mint key; the secret is not returned. Does not broadcast. Required: `creator`, `name`, `symbol`. |
| `build_buy_tx` | Build buy transaction | Unsigned tx | Build an unsigned buy transaction for a LiveLaunch bonding curve. `solAmount` is decimal SOL. Sign locally with `wallet`. Does not broadcast. Required: `mint`, `wallet`. |
| `build_sell_tx` | Build sell transaction | Unsigned tx | Build an unsigned sell transaction. Pass `tokenAmount`, `tokenAmountRaw`, or `percent` (1–100) of the wallet balance. Sign locally with `wallet`. Does not broadcast. Required: `mint`, `wallet`. |
| `build_claim_creator_fees_tx` | Build creator fee claim | Unsigned tx | Build an unsigned transaction that claims the creator trading fees for one LiveLaunch pool to the creator wallet. Pass the creator public key and a mint or pool. Sign locally. Does not broadcast. |

### Example: buy flow

1. Call `get_quote` with `mint`, `side: "buy"`, and the SOL `amount` (optional `slippageBps`; default 300 = 3%). Check `expectedOut`, `minOut`, and `poolFee.protectionEndsAt`. If `protectionEndsAt` is in the future, wait.
2. Call `build_buy_tx` with `mint`, the trader `wallet` public key, and `solAmount`. The tool returns a base64 unsigned versioned transaction and `lastValidBlockHeight`.
3. Deserialize the transaction and **sign it locally** with that wallet. Never send the private key or the signed transaction to this MCP server.
4. Submit the signed transaction with your own Solana RPC before `lastValidBlockHeight` (about a minute). REST `POST /api/v1/tx/send` is optional and is not part of the MCP server.

A minimal Node script that only calls `tools/list` (no keys, no transaction tools) is in [`examples/list-tools.mjs`](./examples/list-tools.mjs).

## Security model

LiveLaunch MCP is **non-custodial**.

- Transaction tools return **unsigned** transactions only. The agent signs locally with its own wallet and submits the transaction itself.
- Never send a private key, seed phrase, secret key, or signed transaction. Those fields are rejected.
- The server does not accept, store, or broadcast private keys or signed transactions.
- Rate limits are shared with the REST API: 120 reads/min and 30 transaction builds/min per IP. REST sends (not available on MCP) are 20/min. HTTP 429 with `Retry-After` when exceeded.
- If `protectionEndsAt` is in the future, wait. New launches currently have launch protection off and `protectionEndsAt` is null.
- Only LiveLaunch bonding curves are in scope. Graduated tokens trade elsewhere (for example Jupiter).

## Fees

Figures below are from live `GET https://livelaunch.vercel.app/api/v1/fees` on 24 November 2026 (Europe/Sarajevo, UTC+1). Before trading a specific token, read that token's `currentFeeBps` and `protectionEndsAt` with `get_token`.

- New launches use config `DaL8kWoBtQwK6bkpScT7b4hAPLPnU26vL3n6dbCciH9t`.
- Pool fee: **1.125%** (`currentFeePct` / `normalFeePct`). Launch protection is off. The variable/dynamic fee is off.
- Of that 1.125% pool fee, Meteora keeps 20% (0.225% of the trade). The rest is split creator 48.8% / platform 31.2% of the pool fee, which is 0.549% and 0.351% of the trade.
- LiveLaunch-built trades also send a **0.20%** streamer fee (`streamerFeePct`) to the token's streamer (the creator unless set). That is on top of the pool fee.
- After graduation, the DAMM v2 pool fee is 1% (`migratedPoolFeeBps`: 100). That 1% is not the bonding-curve fee.

## SDKs and plugins

- npm [`livelaunch-sdk`](https://www.npmjs.com/package/livelaunch-sdk)
- Solana Agent Kit v2: npm [`solana-agent-kit-plugin-livelaunch`](https://www.npmjs.com/package/solana-agent-kit-plugin-livelaunch)
- ElizaOS: npm [`plugin-livelaunch`](https://www.npmjs.com/package/plugin-livelaunch) — source: [slobaloncar/plugin-livelaunch](https://github.com/slobaloncar/plugin-livelaunch)
- DeepSeek Harness: config-only bundle in this repo (`cordis.patch.yml`). See [Use with DeepSeek Harness](#deepseek-harness).

Official registry metadata for this remote server is in [`server.json`](./server.json) (`io.github.slobaloncar/livelaunch-mcp`). This repository does not publish the listing; publishing is a separate, approved step.

## Disclaimer

This is not financial advice. Launching or trading tokens, including memecoins, can result in a total loss of the funds you use. Use only amounts you can afford to lose, and use the tools at your own risk. Nothing in this repository or on the LiveLaunch MCP server is an offer, solicitation, or recommendation to buy or sell any token.
