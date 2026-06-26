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

1. Enable **Secret scanning push protection** (Settings → Code security).
2. Create a **Projects** board per [docs/README.md](./README.md).
3. Confirm CI passes on the first push to `main`.

## Using GitHub CLI (optional)

When `gh` is installed and authenticated:

```bash
gh repo create michael-os --public --source=. --remote=origin --push
```
