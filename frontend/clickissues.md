# cspr.click SDK Integration - Issues & Findings

## Goal

Migrate the Shroud Protocol frontend from `window.CasperWalletProvider()` (Casper Wallet browser extension only) to **cspr.click SDK** for unified wallet connection supporting Casper Wallet, Ledger, MetaMask Snap, and social logins.

### Design Decisions
- Use `sign()` not `send()` — keep existing `sendSignedTransaction()` -> `/api/proxy` flow
- Preserve custom Navbar — use cspr.click programmatically, not the `<ClickUI>` top bar
- Keep `SigningLock` to pause CommitmentContext syncs during signing
- Read balance from cspr.click `AccountType` instead of RPC `getBalance()`

---

## Reference Documents

- **Official docs**: https://docs.cspr.click/
- **React integration guide**: https://docs.cspr.click/cspr.click-sdk/react
- **App registration console**: https://console.cspr.build
- **CDN SDK**: `https://cdn.cspr.click/latest/csprclick-sdk-2.0.js` (1.4MB)

### Key SDK Concepts (from docs)
- `ClickProvider` wraps the app, `useClickRef()` gives access to the SDK instance
- `ClickUI` renders the sign-in modal and top bar (even without `topBarSettings`)
- Events: `csprclick:loaded`, `csprclick:signed_in`, `csprclick:switched_account`, `csprclick:unsolicited_account_change`, `csprclick:signed_out`, `csprclick:disconnected`
- `SignResult`: `{ cancelled, signatureHex, signature, deploy, error }`
- `AccountType`: `{ provider, public_key, balance, liquid_balance, connected_at, providerSupports }`
- App ID `csprclick-template` works on localhost; production needs registration

---

## What We Tried

### Approach 1: NPM Package (`@make-software/csprclick-ui`)

**What**: Install `@make-software/csprclick-ui` and use `ClickProvider`, `ClickUI`, `useClickRef()` as documented.

**Result**: **FAILED** - Turbopack hangs forever.

**Details**:
- `@make-software/csprclick-ui` requires `styled-components ^5.3.9` as a peer dependency
- Project had `styled-components@6.3.11` (incompatible API). Downgraded to `5.3.11`.
- Even after fixing styled-components, the `next/dynamic` import of any component that imports from `csprclick-ui` hangs indefinitely
- The chunks all return HTTP 200 but Turbopack's `Promise.all` in the dynamic loader never resolves
- This happens at module evaluation time, not render time — React error boundaries don't catch it
- Tried `transpilePackages` in `next.config.js` — no effect
- **Root cause**: `@make-software/csprclick-ui` is fundamentally incompatible with Next.js 16 Turbopack. There is no `--no-turbopack` flag in Next.js 16.

### Approach 2: CDN Script Loading (Bypass Turbopack)

**What**: Load the cspr.click SDK via CDN script tag (`https://cdn.cspr.click/latest/csprclick-sdk-2.0.js`) instead of importing from npm. Build a custom React context and SignInModal to replace `ClickProvider` and `ClickUI`.

**Architecture**:
- `CsprClickWrapper.tsx` — injects CDN script, sets up `window.csprClickSDKAsyncInit`, calls `window.csprclick.init()`, listens for `csprclick:loaded`
- `CsprClickContext.tsx` — React context providing the SDK instance (`window.csprclick`)
- `SignInModal.tsx` — custom modal replacing `ClickUI`'s sign-in UI, using `clickRef.getSignInOptions()` and `clickRef.connect()`
- `useWallet.ts` — full rewrite from `CasperWalletProvider` to event-driven cspr.click integration
- `_app.tsx` — wraps app with `CsprClickWrapper` via `next/dynamic` (ssr: false)

**Partial success**: The CDN SDK loads correctly, `window.csprclick` has all expected methods, `getSignInOptions()` returns providers and known accounts.

**Result**: **FAILED** - React hydration breaks.

**Details**:
- Using `next/dynamic` with `ssr: false` to load `CsprClickWrapper` causes React to never hydrate the page
- `body { display: none }` persists (Next.js FOUC prevention never removed because hydration never completes)
- No JavaScript errors in console — the failure is completely silent
- All script chunks load with HTTP 200
- Moving the SDK loading logic directly into `_app.tsx` (no dynamic import) also fails
- Even with `_app.tsx` reverted to near-original (just `CommitmentProvider > Component`), hydration still breaks
- **Root cause**: Adding `@make-software/csprclick-ui`, `@make-software/csprclick-core-client`, `styled-components@5`, `react-modal`, and `react-country-flag` to `package.json` / `node_modules` appears to break Turbopack's client-side compilation even when none of these packages are imported in source code. When all changes are `git stash`-ed (reverting `package.json`), hydration works. When changes are restored, hydration silently fails.

### Approach 2b: Inline SDK hook in `_app.tsx`

**What**: Instead of a separate `CsprClickWrapper` component loaded via `next/dynamic`, put the `useCsprClickSDK()` hook and `CsprClickContext.Provider` directly in `_app.tsx`.

**Result**: **FAILED** - Same hydration issue. The page server-renders correctly (full HTML, correct title) but React never hydrates on the client.

### Approach 2c: Remove type imports from `@make-software/csprclick-core-types`

**What**: Replace `import type { ... } from '@make-software/csprclick-core-types'` with inline interface definitions to prevent Turbopack from resolving the package.

**Result**: **FAILED** - Hydration still broken. The type imports were not the cause.

---

## What Works

- The CDN-loaded SDK (`window.csprclick`) initializes correctly and exposes all documented methods
- `getSignInOptions(true)` returns 3 providers (casper-wallet, ledger, metamask-snap) and known accounts
- The custom `SignInModal` component compiles and renders (when hydration works)
- The rewritten `useWallet.ts` hook compiles without errors
- Server-side rendering produces correct HTML with all content
- The original codebase (without cspr.click packages in node_modules) hydrates and works perfectly

---

## Root Cause Summary

**`@make-software/csprclick-ui` is incompatible with Next.js 16 Turbopack** at two levels:

1. **Direct import**: Importing from `csprclick-ui` causes Turbopack's dynamic module loader to hang forever
2. **Presence in node_modules**: Having `csprclick-ui` (and its dependency tree including `styled-components@5`, `react-modal`, `react-country-flag`) installed in `node_modules` appears to silently break Turbopack's client-side hydration, even when the packages are never imported

Next.js 16 uses Turbopack as its default and only bundler — there is no opt-out.

---

## Possible Next Steps

1. **Wait for csprclick-ui Turbopack compatibility** — the cspr.click team may update the package
2. **Use a standalone HTML page / iframe** for wallet connection that loads the full cspr.click SDK independently of Next.js
3. **Downgrade to Next.js 14/15** where Webpack is still the default bundler
4. **Remove csprclick packages from node_modules entirely** and load everything via CDN with raw `window.csprclick` API (no npm packages at all)
5. **File an issue** with the cspr.click team and/or Next.js team about Turbopack compatibility

---

## Files Created/Modified During Attempts

| File | Status | Notes |
|------|--------|-------|
| `src/components/CsprClickWrapper.tsx` | Created | CDN script loader wrapper |
| `src/components/SignInModal.tsx` | Created | Custom wallet connection modal |
| `src/context/CsprClickContext.tsx` | Created | React context for SDK instance |
| `src/hooks/useWallet.ts` | Modified | Full rewrite for cspr.click events |
| `src/components/Navbar.tsx` | Modified | Added SignInModal + switchAccount |
| `src/pages/_app.tsx` | Modified | Various wrapper approaches tried |
| `src/pages/docs.tsx` | Modified | Removed dead useWallet import |
| `next.config.js` | Created | transpilePackages (didn't help) |
| `package.json` | Modified | Added cspr.click + styled-components deps |
| `.env.local` | Modified | Added CSPRCLICK_APP_ID and APP_NAME |
