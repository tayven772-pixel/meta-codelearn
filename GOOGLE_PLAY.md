# Google Play release checklist

Meta's web project includes Capacitor 8 Android tooling so the same codebase can be wrapped as a native Android app.

## Current Android baseline

- Capacitor 8
- Target/compile SDK expected: Android 16 / API 36
- Web build directory: `dist`
- Application ID declared in the current `capacitor.config.ts`: `app.meta.learn` (confirm this matches the package ID of the existing installed APK before changing it; changing it can create a separate app listing).
- Public privacy route: `/privacy`
- Edge-to-edge safe-area CSS included
- The core app does not request sensitive device permissions

## Before a Play Store release

1. Run `npm install`.
2. Run `npm run android:add` once to generate the Android project.
3. Run `npm run android:sync` after web changes.
4. Open Android Studio with `npm run android:open`.
5. Verify `compileSdkVersion` and `targetSdkVersion` are 36.
6. Create a signed Android App Bundle (.aab), not only an APK.
7. Complete Play Console App content, Data safety, Content rating, Target audience, Ads, and privacy-policy declarations accurately.
8. Provide the store listing support contact and a publicly reachable privacy-policy URL.
9. Test sign-in, account handling, lesson progress, external links, back navigation, rotation/resize, offline/error states, and Android 16 edge-to-edge behavior.
10. If children are included in the selected target audience, complete the Families requirements and ensure all content/data practices match that selection.

Google Play approval cannot be guaranteed by source code alone; Play Console declarations and review are part of compliance.


## Code-side readiness currently present

- Public privacy policy route: `/privacy`
- Public account-deletion information route: `/delete-account` (currently directs users to contact support; this is not a verified self-service deletion flow)
- Public support contact is displayed on policy/deletion pages
- Responsive/mobile safe-area handling is included
- Capacitor Android wrapper configuration is included
- PWA metadata and app theme metadata are included

## Blocking items before claiming store readiness

- End-to-end test the new in-app account deletion endpoint and UI, including session invalidation and deletion of associated database rows. The current `/delete-account` page is email-request based, so confirm that the external deletion resource meets current Play policy and improve it if necessary.
- Confirm the actual Android package ID and persistent signing identity from the currently distributed APK before publishing an update.
- Test the installed APK against the intended production website and verify that login, logout, and project flows work.

## Play Console items that still require the publisher

These cannot be completed truthfully by source code alone. Before release, the publisher must complete the Play Console Data safety form, account-deletion URL field, Target audience and content declaration, IARC content rating, Ads declaration, app-access/reviewer instructions for sign-in, store listing, privacy-policy URL, support contact, and signing/release setup. The answers must match the actual production app and any third-party SDKs in use.
