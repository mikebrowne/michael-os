# Push to GitHub

Use these steps when the GitHub CLI (`gh`) is not available locally.

## Create the repository

1. Sign in to GitHub and create a new **public** repository named `michael-os`.
2. Do **not** initialize with a README (this repo already has one).
3. Set the license to **MIT** if prompted (already in repo).

## Push local commits

From the repository root:

```bash
git remote add origin git@github.com:<your-user>/michael-os.git
git push -u origin main
```

Or with HTTPS:

```bash
git remote add origin https://github.com/<your-user>/michael-os.git
git push -u origin main
```

## After push

1. Create a **Projects** board per [docs/README.md](./README.md).
2. Enable **GitHub push protection** (see below).
3. Confirm CI passes on the first push to `main`.

## GitHub push protection (native secret scanning)

This is **not** the Gitleaks CI job. GitHub's own secret scanning can block pushes that contain known secret patterns.

As of 2026, enable it from the repository on GitHub:

1. Open the repo → **Settings** (under the repo name; use the **⋯** menu on smaller viewports).
2. In the left sidebar under **Security**, click **Advanced Security**.
3. If **Secret Protection** is off, click **Enable** next to it.
4. Under **Secret Protection**, click **Enable** next to **Push protection**.

If you do not see **Advanced Security**, your account or org plan may not include it on private repos. For **public** repositories, secret scanning is available on GitHub Free.

Docs: [Enabling push protection](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection)

## Gitleaks in CI

The `secret-scan` job in `.github/workflows/ci.yml` runs [Gitleaks](https://github.com/gitleaks/gitleaks) on every push/PR. It is independent of GitHub push protection. Configuration lives in `.gitleaks.toml` at the repo root.

## Using GitHub CLI (optional)

When `gh` is installed and authenticated:

```bash
gh repo create michael-os --public --source=. --remote=origin --push
```
