# Meta CodeLearn Roadmap

This is the shared backlog for the website, Android app, and planned iOS app. Keep the existing dashboard colours, visual language, and familiar layout. Prefer progressive disclosure, clear labels, and focused pages over adding clutter to the dashboard.

## Priority 0 — release safety and account correctness

- [ ] Run the pull-request CI build before merging changes.
- [ ] Test email/Google and Discord login and logout end-to-end.
- [ ] Confirm account state after logout is cleared on both auth endpoints.
- [ ] Verify session cookies, redirects, and protected pages in a real browser.
- [ ] Confirm the production origin used by the website and Capacitor app.
- [ ] Keep database files, environment files, signing keys, and backups out of Git.
- [ ] Make production deployment reversible with a timestamped web-root backup.

## Priority 1 — projects

- [ ] Reproduce and document each reported broken project action.
- [ ] Test create, open, rename/edit, save, download/export, and delete flows.
- [ ] Add clear empty, loading, and error states.
- [ ] Add search and filters for project type and status without changing dashboard styling.
- [ ] Add project status (Not started / In progress / Completed) and a last-updated label.
- [ ] Explain where project data is stored; do not imply cross-device sync until server-side sync exists.
- [ ] Add regression tests for project persistence and routing.

## Priority 1 — account identity and verification

- [ ] Display the profile image and display name returned by the actual sign-in provider.
- [ ] Use Google profile image for Google accounts and Discord avatar for Discord accounts.
- [ ] Only treat Discord email as verified when Discord OAuth returns a verified email field.
- [ ] Request only required Discord OAuth scopes.
- [ ] Add members to the configured Discord server only after explicit OAuth consent and server/bot permissions are confirmed.
- [ ] Test failed, cancelled, expired, and already-linked account cases.

## Priority 2 — desktop usability (preserve current design)

- [ ] Audit the dashboard at narrow phone, tablet, laptop, and wide desktop widths.
- [ ] Make navigation and project actions comfortable with mouse, keyboard, and touch.
- [ ] Keep primary actions easy to find; move secondary options into existing settings/details areas.
- [ ] Check focus visibility, labels, contrast, and reduced-motion behavior.
- [ ] Avoid adding dashboard cards unless they solve a demonstrated user need.

## Priority 2 — Apple and Google store readiness

- [ ] Confirm product scope and meaningful app-specific functionality beyond a basic website wrapper.
- [ ] Implement and test in-app account deletion, including eligible associated data.
- [ ] Keep the external account-deletion page publicly accessible.
- [ ] Review privacy policy, retention, analytics, third-party SDKs, and data disclosures against actual behavior.
- [ ] Complete store listing, age/target-audience declarations, content rating, support contact, and reviewer sign-in instructions.
- [ ] Test app navigation, login, logout, external links, safe areas, network failures, and accessibility.
- [ ] For Google Play, produce a correctly signed Android App Bundle using the persistent publisher signing setup.
- [ ] For Apple, configure the iOS project, signing, privacy declarations, screenshots, and App Store Connect metadata.
- [ ] Treat approval as pending until the respective store completes review.

## Every release

- [ ] CI passes on the exact commit to release.
- [ ] Review the diff and ensure no secrets or local data were committed.
- [ ] Build the website and retain the build logs.
- [ ] Back up the live web root before deployment.
- [ ] Smoke-test production sign-in, sign-out, protected routes, and projects.
- [ ] Build a fresh Android artifact when app-bundled code or native configuration changes.
- [ ] Install and test the APK; do not assume a successful build means it works.
- [ ] Keep the previous known-good APK available for rollback.
- [ ] Track iOS build and store review separately from Android.

## Current known cautions

- The account logout change is on a pull-request branch and must pass CI plus live manual tests before merging.
- The repository contains two Android workflows; inspect their signing secrets and behavior before relying on either for a production release.
- The current Capacitor config points to a Vercel URL. Confirm the intended production origin before changing this, because it affects which website the installed wrapper loads.
