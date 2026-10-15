# Deploying Meta CodeLearn to the VPS

Use this after the change has been reviewed, merged into `main`, and CI has passed. These commands do not copy secrets into GitHub.

## 1. Inspect the VPS checkout first

```bash
cd /opt/meta-codelearn
git status --short
git remote -v
git branch --show-current
```

Do not proceed if there are tracked edits you need to keep. Do not run `git reset --hard`, `git clean`, or delete untracked files to force an update. Existing untracked Discord data and backups must be preserved.

## 2. Fetch and fast-forward the source

```bash
cd /opt/meta-codelearn
git fetch origin
git log -1 --oneline
git log -1 --oneline origin/main
```

If the working tree is safe and the current branch is `main`, update it without creating a merge commit:

```bash
git pull --ff-only origin main
```

If Git refuses, stop and inspect the error instead of forcing it.

## 3. Build before publishing

```bash
cd /opt/meta-codelearn
npm ci
node --check server/auth.js
npm run build
test -s dist/index.html && echo "Build output exists"
```

Do not deploy if a command fails.

## 4. Back up and publish the static website

First confirm the live web root with your existing Nginx configuration. The known deployment path has been `/var/www/html`, but verify before copying:

```bash
sudo nginx -T 2>/dev/null | grep -nE 'root |server_name '
```

Only if `/var/www/html` is confirmed as the correct root, create a backup and copy the new build:

```bash
sudo cp -a /var/www/html "/var/www/html-backup-$(date +%Y%m%d-%H%M%S)"
sudo cp -a /opt/meta-codelearn/dist/. /var/www/html/
```

This updates static website files only. It does not update the running authentication service or Discord bot. Those require their own reviewed deployment steps.

## 5. Smoke test

Open the production website and verify sign-in, sign-out, account page, protected pages, and projects. If anything fails, stop further deployment and restore the latest backup after confirming the correct backup directory.

## Android APK

The repository's GitHub Actions workflows can build Android artifacts. Check the Actions run for the exact commit, download the artifact, install it on a test device, and verify it before publishing. A website deployment alone does not replace a downloadable APK when the APK bundles web assets or native code.

Do not commit `android/app/meta-release.jks`, passwords, OAuth secrets, or environment files. Keep signing keys in a secure backup and use GitHub Actions secrets only for CI signing.
