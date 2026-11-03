# SeamScope v1.0.0 pilot evidence package

This package is the sanitized, progressively disclosed evidence companion for
the SeamScope pilot study. It lets a reader verify the reported counts and
inspect representative evidence without exposing the private machine-specific
collection workspace.

Start here:

1. `pilot-v1/results/interim-results.json` contains the aggregate result.
2. `pilot-v1/results/confirmatory-runs.csv` lists every confirmatory attempt.
3. `pilot-v1/runs/` contains the normalized manifest, event, capture, and
   verdict records for all 88 confirmatory attempts.
4. `paper-evidence/representatives/` contains the manuscript-facing lifecycle
   and sequence-46 data products.
5. `paper-evidence/claim-assessments/` demonstrates the small claim-specific
   verdict companion discussed in the paper.
6. `pilot-v1/runs/c001-injected-healthy-r01/`,
   `pilot-v1/runs/c002-bumble-healthy-r01/`, and
   `pilot-v1/runs/c046-bumble-dropped-r10-retry01/` contain the selected
   representative screenshots or sanitized traces.

The package contains 88 confirmatory attempt directories: 87 protocol-eligible
attempts and one explicitly retained excluded attempt. The eligible attempts
contain 50 valid outcomes (49 pass and one fail) and 37 invalid attempts.
Calibration runs, dry runs, most verbose raw logs, and the private freeze
metadata are intentionally excluded.

`package-manifest.json` records the source revision, scope, file identities,
and study counts. `structured-equivalence.json` proves that the normalized run
records are byte-identical to their private sources. `checksums.sha256`
identifies every released file.

This is the v1.0.0 evidence companion archived under
<https://doi.org/10.5281/zenodo.23903535>. Its package manifest identifies the
exact tagged source revision from which it was built.

