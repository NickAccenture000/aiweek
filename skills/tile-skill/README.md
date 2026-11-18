# tile-skill

Build HTML for Tile and operate the tiles it serves, using the supported SDK and platform capabilities.

## Installation

Install the skill from the catalog:

```sh
acn skills install tile-skill
```

Alternatively, download this repository as a ZIP file, extract it, then point your coding agent to the extracted folder and ask it to install the skill.

## Contents

- `SKILL.md` contains the workflow and capability router.
- `references/` documents each supported Tile capability.
- `examples/` contains complete implementation examples.
- `manifest.json` contains the package name and version. Its version must match the release tag.
- `governance.json` records ownership and review policy.

## Maintainer validation

Run the release checks from the source repository. They need Python 3.9 or later; the example runtime tests also need Node.js and are skipped without it. `-B` keeps Python from writing `__pycache__`, which the check rejects.

macOS and Linux:

```sh
python3 -B scripts/check.py .
python3 -B -m unittest discover -s tests/static
```

Windows (PowerShell or Command Prompt):

```powershell
py -B scripts\check.py .
py -B -m unittest discover -s tests\static
```

## Publishing

A release is a semver tag. Edit the files, then:

```sh
git add -A
git commit -m "Describe the change"
git tag v0.1.0
git push origin main --tags
```

`manifest.json`'s `version` must match the tag without the leading `v`, or the tag is
flagged invalid and never appears in the catalog.
