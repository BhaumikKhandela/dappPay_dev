# DappPay – AI-Powered Payroll on Solana

**The fastest, most private way to run payroll entirely on-chain.**  
No custodians. No middlemen. No servers holding your keys.

DappPay lets anyone create organizations, add workers, fund treasuries, and process payroll — all with natural-language commands powered by an AI assistant that runs **100% in your browser**.

Live demo → https://dapppay.app (or your deployed URL)

https://user-images.githubusercontent.com/25317499/1234567890-placeholder-screenshot-dashboard-light.png
*(Light mode screenshot – replace with your own)*

## Why DappPay is Different

| Feature                        | Traditional Payroll | Most Crypto Payroll | DappPay                              |
|-------------------------------|---------------------|---------------------|--------------------------------------|
| Natural language control      | ❌                  | ❌                  | ✅ Just type “Pay everyone at Tesla” |
| OpenAI key stored on servers  | ✅ (most tools)     | ✅ (most tools)     | ❌ Never leaves your browser        |
| On-chain & auditable          | ❌                  | ✅                  | ✅ Everything on Solana              |
| Wallet stays non-custodial    | ❌                  | Sometimes           | ✅ You always sign transactions     |
| Zero backend user database    | ❌                  | ❌                  | ✅ No accounts, no emails            |

## Core Features

- **AI Chat Assistant** – Speak plain English:  
  `"Create organization Apple"` → `"Add worker 7yQ... to Apple salary 5 SOL"` → `"Process payroll for Apple"`
- **Instant On-Chain Execution** – All actions are real Solana transactions signed by your wallet
- **Privacy-First** – Your OpenAI API key is stored only in browser memory and wiped on page leave
- **No Login, No KYC** – Connect any Solana wallet (Phantom, Solflare, Backpack, etc.)
- **Batch Payments** – Pay 1 or 1,000 workers in a single transaction
- **Treasury Management** – Fund, withdraw, and monitor organization balances in real-time

## Quick Start (30 seconds)

1. **Connect your Solana wallet** (top-right button)
2. **Paste your OpenAI API key** when prompted  
   → Get one free at https://platform.openai.com/api-keys  
   → Your key is **never stored** – only lives in your browser
3. Start typing in the chat:

```text
Create organization Tesla
Add worker 7yQv4p... to Tesla salary 3.2 SOL
Fund Tesla with 50 SOL
Process payroll for Tesla
```

That’s it. The AI remembers context and executes everything on-chain.

## Example Commands (just copy-paste)

| Goal                        | Command                                      |
|-----------------------------|----------------------------------------------|
| List your orgs              | `Show my organizations`                      |
| Create new org              | `Create organization Google`                 |
| Add a worker                | `Add worker Hx9... to Google salary 4.5 SOL` |
| Fund treasury               | `Fund Google with 100 SOL`                   |
| Pay everyone                | `Process payroll for Google`                 |
| Withdraw leftover funds     | `Withdraw 20 SOL from Google`                |

## Tech Stack

- **Frontend** – Next.js 14 (App Router) + TypeScript + Tailwind
- **Blockchain** – Solana + Anchor (Rust) smart contracts
- **AI Layer** – Bring-your-own OpenAI key (client-side only)
- **Wallet** – Wallet Adapter + Phantom/Solflare support
- **Deployment** – Vercel (frontend) + Solana Mainnet/Devnet

## Project Structure

```
├── anchor/                  # Solana program (Rust + Anchor)
│   └── programs/
│       └── payroll_program/ # create_org, add_worker, fund, payroll, withdraw
├── app/                     # Next.js 14 pages
│   ├── dashboard/page.tsx   # Main AI chat + org panel
│   ├── privacy/page.tsx     # Privacy-first policy
│   └── test/page.tsx        # Manual transaction tester
├── components/              # ChatPanel, OrganizationsPanel, Header, etc.
├── lib/                     # MCP tools (AI → on-chain function calls)
├── services/blockchain.ts   # Wallet + program interactions
└── utils/                   # Helpers & interfaces
```

## Local Development

```bash
# Clone & install
git clone https://github.com/daltonic/dappPay.git
cd dappPay

# Install frontend deps
npm install

# Build & test the Anchor program
cd anchor
anchor build
anchor test          # runs tests/payroll_program.ts

# Start dev server
cd ..
npm run dev
# → http://localhost:3000
```

### Required Environment Variables (.env.local)

```env
NEXT_PUBLIC_SOLANA_RPC_URL=localhost
# or devnet for testing
```

No OpenAI key in .env – users paste it live in the browser.

## Deploy Your Own

```bash
# 1. Deploy program (Devnet first!)
cd anchor
anchor deploy --provider.cluster devnet

# 2. Update program ID in frontend (lib/payroll-mcp-tools.ts or consts)
# 3. Push to GitHub → Vercel auto-deploys
```

## Privacy & Security

- Your OpenAI key **never touches any server**
- Chat history lives only in your browser (localStorage)
- All transactions are signed by your wallet – non-custodial
- On-chain data is public (Solana is transparent by design)

Full privacy policy: `app/privacy/page.tsx`


## Roadmap

- [ ] Recurring payroll schedules (cron on-chain via Clockwork)
- [ ] Multi-sig treasuries
- [ ] Token payroll (USDC, custom SPL)
- [ ] Mobile wallet deep-linking
- [ ] Organization invites & permissions

## Contributing

PRs welcome! Especially:
- Better error messages from the AI
- Mobile UX polish
- Additional natural-language examples

## License

MIT © 2025 Darlingtons Gospel

---

**DappPay – Payroll should be as easy as chatting.**  
No logins. No servers holding your keys. Just Solana + AI.