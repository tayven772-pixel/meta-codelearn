# Apple App Store readiness checklist

This is a work plan, not a claim of approval or completed compliance. Keep the current Meta CodeLearn visual identity while adding app-specific value and improving accessibility.

## Current known position

- The repository is a React/Vite web app with Capacitor 8 tooling.
- The current Capacitor config points the wrapper at the production website.
- A simple website wrapper may not satisfy Apple's minimum-functionality review expectations on its own. The iOS app needs a clear, useful app experience and must be tested as an app.
- The public privacy policy is at `/privacy`.
- The public `/delete-account` page currently gives contact instructions; it is not a verified self-service deletion workflow.

## Blocking implementation work

- [ ] Implement and test in-app account deletion for accounts created in Meta CodeLearn.
- [ ] Make the external deletion route usable and clear, and ensure deletion requests are actually fulfilled.
- [ ] Review Google, email, and Discord sign-in flows for secure session creation, logout, account linking, and recovery.
- [ ] Review whether Sign in with Apple is required based on the sign-in providers offered and Apple's applicable guidelines.
- [ ] Verify that Google/Discord profile pictures are displayed safely and that users can override/remove a custom image.
- [ ] Ensure privacy policy disclosures match real data collection, retention, third-party services, and account deletion behavior.
- [ ] Define meaningful app-specific functionality beyond a remote website wrapper.
- [ ] Configure and test the iOS project, bundle identifier, entitlements, signing, and release build on a supported Mac/Xcode setup.
- [ ] Test login/logout, protected routes, project create/edit/export, network failure, external links, keyboard/accessibility, safe areas, and app lifecycle.
- [ ] Prepare App Store Connect metadata, screenshots, support contact, privacy answers, age rating, and reviewer access instructions.

## Release gate

- [ ] All relevant automated checks pass on the exact release commit.
- [ ] A real iOS build is installed and tested on supported hardware/simulator.
- [ ] Account deletion is verified end-to-end, not only documented.
- [ ] Privacy declarations are reviewed against the actual shipped binary and services.
- [ ] Submission is reviewed in App Store Connect; approval remains Apple's decision.
