# GlitchWitcher: REPD-based Defect Prediction

A machine learning system that predicts software defect likelihood using reconstruction error analysis with autoencoders and statistical distribution fitting.

## 🎯 Overview

This project implements a novel approach to software defect prediction that combines:

- **Autoencoder neural networks** for dimensionality reduction and feature extraction
- **Reconstruction error analysis** to identify anomalous code patterns
- **Statistical distribution fitting** to model defect vs. non-defect characteristics
- **Automated CI/CD integration** via GitHub Actions for real-time code quality assessment

## 🚀 Features

- **Automated defect prediction** on pull requests
- **Traditional software metrics extraction** (complexity, lines of code, etc.)
- **Deep learning-based feature transformation** using autoencoders
- **Probabilistic defect analysis** using Probability Density Functions (PDFs)
- **Pre-trained model support** for fast predictions
- **GitHub Actions integration** for seamless CI/CD workflows

## 📊 How It Works

1. **Feature Extraction**: Extract traditional software metrics from source code.
2. **Model Training**: Train an autoencoder on a large corpus of non-defective code.
3. **Error Analysis**: Calculate the model's reconstruction error for new code. A higher error suggests the code is anomalous.
4. **Distribution Fitting**: Model the reconstruction error distributions for both historically defective and non-defective code.
5. **Prediction**: For new code changes, calculate the PDF value against both distributions to determine which category is a better fit.

## 🔬 Technical Details

### Architecture

- **Autoencoder**: [20, 17, 7] hidden layer configuration
- **Training**: 500 epochs, learning rate 0.001, batch size 128
- **Distributions**: Automatic best-fit selection (e.g., Log-Normal, Pareto) for error distributions.
- **Error Function**: L2 norm reconstruction error

### Supported File Types

- C/C++ source files (`.c`, `.cpp`, `.cxx`, `.cc`, `.h`, `.hpp`, `.hxx`)

## ⚙️ GitHub Actions Workflow: GlitchWitcher

This repository provides a GitHub Actions workflow that runs GlitchWitcher analysis on demand via issue/PR comments and manages datasets/models.

### How to trigger

- Run analysis on a specific PR (from any issue/PR):
  - Comment: `GlitchWitcher https://github.com/<owner>/<repo>/pull/<number>`
- Run analysis on the same PR you’re commenting on (C/C++ only):
  - Comment: `GlitchWitcher`

Notes:

- The trigger is case-sensitive and activates on new comments that contain the literal string `GlitchWitcher`.
- Only C/C++ files are analyzed: .c, .cpp, .cxx, .cc, .h, .hpp, .hxx.

### What the workflow does

- Parses your comment to identify the target PR.
- Checks for an existing dataset and model in adoptium/aqa-triage-data at:
  - `GlitchWitcher/Traditional Dataset/<owner-repo>/<owner-repo>.csv`
  - `GlitchWitcher/Traditional Dataset/<owner-repo>/trained_model/`
- If missing:
  - Generates the dataset CSV and trains a model.
  - Opens a PR to `adoptium/aqa-triage-data` with the CSV and `trained_model/`.
  - Attempts to auto-merge that PR so analysis can continue.
- Runs analysis on changed C/C++ files between base and head of the target PR and posts a comment with results.

The posted comment includes:

- A comparison of base vs head predictions for changed files.
- An interpretation note clarifying that reported values are PDFs (not probabilities).

### Requirements

- Workflow file: `.github/workflows/glitchwitcher.yml`
- Runner: `ubuntu-latest`
- Tooling:
  - Python 3.10
  - pip dependencies: `tensorflow==2.12.0 pandas joblib scipy numpy urllib3 scikit-learn`
  - apt packages: `cloc git`
- Permissions (as set in the workflow):
  - `pull-requests: write`
  - `issues: write`
  - `contents: read`

### Secrets

- `TRIAGE_PAT` in `aqa-test-tools` repository secrets.
  - Classic PAT: `repo` scope.
  - Fine-grained PAT: repository `adoptium/aqa-triage-data` with:
    - Contents: Read & write
    - Pull requests: Read & write
- The PAT user must be able to push branches and merge PRs in `adoptium/aqa-triage-data`.

### Caveats

- Branch protection or required reviews in `adoptium/aqa-triage-data` can block the auto-merge step; the workflow attempts to merge via the API but will respect repo policies.
- Large ML dependencies can increase run time and disk usage on the runner.
- If no supported files changed, the workflow exits with a note.

### Troubleshooting

- “Invalid GlitchWitcher command format or missing PR link”:
  - Include a PR link or comment directly on a PR with `GlitchWitcher`.
- “No C/C++ files found in the PR changes”:
  - The PR didn’t modify supported files.
- “No model found for predictions”:
  - Model artifacts could not be found or created; verify `TRIAGE_PAT` and the PR created in `aqa-triage-data`.
- Permission/PAT errors:

## 📊 Example Output

### 📊 Bug Prediction Analysis

#### File: `example.cpp`

Outcome: Defective -> Non-Defective

| Metric                                     | BEFORE PR   | AFTER PR    | % Change |
| ------------------------------------------ | ----------- | ----------- | -------- |
| PDF(Defective \| Reconstruction Error)     | 2.51234e-08 | 1.12345e-08 | -55.23%  |
| PDF(Non-Defective \| Reconstruction Error) | 8.94561e-09 | 7.65432e-08 | +755.44% |

#### File: `utils.cpp`

Outcome: Non-Defective -> Non-Defective

| Metric                                     | BEFORE PR   | AFTER PR    | % Change |
| ------------------------------------------ | ----------- | ----------- | -------- |
| PDF(Defective \| Reconstruction Error)     | 5.67890e-09 | 4.23456e-09 | -25.43%  |
| PDF(Non-Defective \| Reconstruction Error) | 3.21098e-08 | 3.87654e-08 | +20.73%  |

### 📋 Interpretation Note:

> The values shown are Probability Densities (PDFs), not probabilities. They represent the model's assessment of how likely a file's characteristics are to be 'defective' vs. 'non-defective'. A higher value indicates a better fit for that category. Very small values are expected and normal.

## 📚 Citation

This implementation is based on the research paper:

**Petar Afric, Lucija Sikic, Adrian Satja Kurdija, Marin Silic**  
_REPD: Source code defect prediction as anomaly detection_  
Journal of Systems and Software, Volume 168, 2020, 110641  
ISSN 0164-1212  
https://doi.org/10.1016/j.jss.2020.110641
