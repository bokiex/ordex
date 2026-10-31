# Research: whatsapp-web.js Issue #201947

## Question

Does the reported WhatsApp Web forwarding regression have a fix branch, and could it explain Ordex's WhatsApp group worker stopping before its `ready` event?

## Finding

**Yes, a proposed fix exists, but it is an open pull request from a contributor fork—not an upstream branch or released fix.** It addresses `Message#forward()` and several other lazily bundled WhatsApp Web modules. It does **not** address client initialization, authentication, or the `ready` event, so it does not explain Ordex authenticating without becoming ready.

## Primary-source evidence

### The reported defect

[Issue #201947](https://github.com/wwebjs/whatsapp-web.js/issues/201947) is open. It reports that `message.forward(chat)` fails on WhatsApp Web `2.3000.1047687307` because `WAWebChatForwardMessage` is unavailable and `forwardMessages` is read from `undefined`.

Upstream `main` still calls the eagerly required forwarding module in [`src/util/Injected/Utils.js`](https://github.com/wwebjs/whatsapp-web.js/blob/main/src/util/Injected/Utils.js#L113-L129). [`Message#forward()`](https://github.com/wwebjs/whatsapp-web.js/blob/main/src/structures/Message.js#L500-L508) delegates to that helper.

### Proposed fix branch

The issue timeline links to [PR #201950, “fix: load lazily bundled WhatsApp Web modules before using them”](https://github.com/wwebjs/whatsapp-web.js/pull/201950).

| Property | Value |
|---|---|
| Status | Open; not merged |
| Base | `wwebjs/whatsapp-web.js:main` at `064a3d5a5a3dce1281a6a12740b5a7051339d154` |
| Fix branch | `alpersamur3/whatsapp-web.js:fix/forward-message` |
| Fix commit | [`17c99579d486d8b6665929ae1b17c553c51441a7`](https://github.com/wwebjs/whatsapp-web.js/commit/17c99579d486d8b6665929ae1b17c553c51441a7) |
| Patch | [PR file diff](https://github.com/wwebjs/whatsapp-web.js/pull/201950/files) |

The PR adds `window.WWebJS.requireLazy()`. When a module is absent, it calls WhatsApp Web's `JSResourceForInteraction(component).load()` to load the screen bundle containing the module, then retries `window.require(moduleName)`. It applies this pattern to forwarding and several unrelated APIs: group creation/invites, display-name changes, status revocation, call links, and scheduled-event editing.

The PR has one commit. Its visible checks are title/label automation only; there is no completed functional test run in the PR checks. Treat it as an unreviewed upstream proposal, not a production-ready release.

### Release status

The latest upstream release is [v1.34.7](https://github.com/wwebjs/whatsapp-web.js/releases/tag/v1.34.7). Its release notes predate issue #201947 and do not include PR #201950. Ordex uses `whatsapp-web.js@1.34.7` for its separate [frozen-start/auth-timeout fix](https://github.com/wwebjs/whatsapp-web.js/pull/127048), but v1.34.7 does not contain this proposed forwarding fix.

## Ordex impact

Ordex's group worker does not call `Message#forward()` or `WAWebChatForwardMessage`:

- `src/workers/whatsapp-group/handlers.ts` consumes incoming `message` events, filters group messages, and posts their text to Ordex.
- `src/workers/whatsapp-group/index.ts` only logs `Ready. Forwarding group messages ...` from the WhatsApp client `ready` event.

The reported forwarding regression occurs only when an application explicitly calls `message.forward(chat)` after the client is already operational. It cannot cause the client to authenticate but never emit `ready`.

## Recommendation

1. **Do not switch Ordex to the fork branch to resolve the missing `ready` event.** It changes unrelated unsupported APIs and has no connection to the worker's receive-only flow.
2. **Do not expect an upgrade to v1.34.7 to include this fix.** The proposed PR is newer and remains open.
3. If Ordex later needs to forward messages, trial the fork only in an isolated environment with a locked commit and a regression test for `message.forward()`. Prefer waiting for the PR to be reviewed, merged, and released upstream.
4. Continue the current worker investigation at the authentication-to-readiness boundary; that is a separate failure mode.
