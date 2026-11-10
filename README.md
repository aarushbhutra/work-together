# Study Together

A Chrome extension for a small study club: shared rooms, a common website blocklist, and five-minute passes that require every other member’s approval. The interface has warm paper colors, editorial serif type, coral accents, and playful puzzle details inspired by Minute Cryptic. It uses original artwork and system fonts.

## Try it locally

Requires Node.js 20+ and Chrome 120+. There are no packages to install.

```bash
npm start
```

Open **http://localhost:8787** to explore the interface. **Take a peek inside** opens a labeled sample room with interactive sample votes and blocklist editing. The browser view can also create and join real rooms, but website blocking and system notifications require the extension.

1. Open **chrome://extensions** in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project’s **extension** folder.
4. Pin Study Together, then click its icon to open your study space.
5. Choose **Create a room**, enter your name and room name, and invite a friend using **Copy invite**.
6. On the other browser profile or computer, load the same extension and choose **Join a room**. Enter the code and the same server address under **Room server settings**.

For a quick end-to-end test on one computer, use two separate Chrome profiles. Join as two different people, visit `youtube.com` in the first profile, and approve the request in the other. The blocked page automatically asks the room when a blocked domain is opened. Click **Open website** once the room approves.

Enable Chrome notifications in your operating system. Where notification action buttons are supported, friends can approve directly in the notification. Clicking the notification opens the room in a small window; the dashboard also always provides voting buttons.

## Study with friends on other computers

Everyone must connect to **one running server**. `localhost` always refers to the individual computer.

- On the same trusted Wi-Fi, use the server computer’s LAN address, such as `http://192.168.1.20:8787`, in **Room server settings** on every computer. Allow inbound traffic to this port in the host firewall.
- For different networks, host `server/index.js` on a Node-capable service with an HTTPS endpoint. Set `PORT` if the host requires it. The server binds to `0.0.0.0` by default; `HOST` can override this.
- Share both the room code and the HTTPS server URL. The included server serves the web interface and the room API together.

The extension is loadable locally; it has not been submitted to the Chrome Web Store. This project does not provision a hosted room server.

## How the agreement works

- A six-character room code lets friends join, up to 12 people.
- Anyone can add a domain. Only the current room creator can remove domains. Ownership transfers if the creator leaves.
- Chrome redirects blocked top-level website requests before the destination loads. Blocking includes subdomains. Pages already open before joining or adding a domain must be reloaded; this version does not close existing tabs.
- Opening a blocked website automatically creates an approval request. You can also use **Ask the room** and include a reason.
- Every other member present when the request is created must approve. The requester cannot vote on their own request. Joining later does not alter an existing vote.
- One rejection keeps the site blocked. Offline members remain in the approval group; there is no automatic approval timeout.
- A unanimous approval creates a five-minute allowance **for the requester’s browser only**. The clock begins when the final vote arrives. Chrome alarms remove expired allowances, including while the room server is offline. Alarms can be delayed by system sleep; rules are rechecked when Chrome resumes.
- Pending requests expire after ten minutes. Leaving cancels pending requests involving that person.
- Room screens refresh every three seconds. The background worker checks about every five seconds while awake; a Chrome alarm wakes it every thirty seconds. Allow up to thirty seconds for a notification or shared blocklist change. Chrome/OS notification display varies by platform.
- The room stores blocked domains, names, requests, reasons, votes, and a short activity feed. Full URLs and general browsing history are not sent to the server.
- This is voluntary accountability: participants can leave or disable the extension. It is not a parental-control system.

## Server and privacy limits

This is a working prototype. Rooms live in server memory and disappear when the server restarts. Room codes are invitations; share them only with your study group. Each participant receives a separate secret credential, never exposed in shared room responses. The server includes input validation, request-size limits, and a basic per-IP mutation rate limit. Before operating it as a public service, add persistent storage, account authentication, stronger abuse controls, and an appropriate privacy policy.

The extension requests HTTP/HTTPS host access to enforce user-selected blocklists and contact your chosen room server. It uses `storage`, `declarativeNetRequest`, `alarms`, and `notifications`. It runs no remote scripts and injects no content scripts into websites. Chrome’s [declarativeNetRequest documentation](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) describes the redirect rules used here.

## Verify and package

```bash
npm test
python3 scripts/package.py
```

Tests cover the room protocol, authentication isolation, unanimous approval, rejection, expiry, membership changes, ownership transfer, HTTP routing, and per-user Chrome rules. HTTP-handler tests run in-process, without opening a port. Chrome UI, OS notification rendering, and an actual multi-device connection still need a manual browser check.

The packaging script produces `study-together-extension.zip`. Extract it before using **Load unpacked**. The room server runs separately from the extension.

## Files

```text
extension/     Manifest V3 extension, room UI, blocked page, service worker
server/        Dependency-free Node HTTP server and room logic
tests/         Node tests for room behavior, routing, and Chrome rule generation
scripts/       Extension packaging utility
```
