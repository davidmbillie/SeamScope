# Evidence capture scaffold

The evidence store creates append-oriented run records under the git-ignored
`artifacts/evidence` directory. The raw directory layout follows
`docs/pilot-protocol-decisions.md`; frozen study exports retain the same layout
when deposited with the research artifact.

The CLI deliberately does not launch the emulator, Appium, Bumble, or the
fixture. It establishes the record boundary into which those processes will be
wired after dry-run calibration.

## Commands

Run commands from `automation`.

Create a draft calibration study:

```powershell
node .\scripts\evidence-cli.mjs init-study `
  --study-id pilot-v1 `
  --protocol-version pilot-v1-draft `
  --repetitions 10
```

Create a run record:

```powershell
node .\scripts\evidence-cli.mjs start-run `
  --study ..\artifacts\evidence\pilot-v1 `
  --case healthy-threshold `
  --route injected `
  --repetition 1 `
  --configuration pixel-api35-debug
```

The command prints the new run directory. Record a normalized event:

```powershell
node .\scripts\evidence-cli.mjs event `
  --run <run-directory> `
  --source runner `
  --type stimulus-issued `
  --sequence 1 `
  --details '{"speed":8}'
```

Finalize a valid run:

```powershell
node .\scripts\evidence-cli.mjs verdict `
  --run <run-directory> `
  --validity valid `
  --outcome pass `
  --expected 'In Motion view displays 8.0' `
  --observed 'In Motion view displayed 8.0' `
  --claim 'Accepted observations cause the configured transition'
```

Validate completeness and run-local event ordering:

```powershell
node .\scripts\evidence-cli.mjs validate-run --run <run-directory>
```

## Invariants already enforced

- Run identifiers and run directories cannot be silently overwritten.
- A BLE-only fault case cannot be assigned to the injected route.
- Every normalized event carries the run identifier and a contiguous local
  event index.
- An invalid run must have outcome `not-evaluated`; it cannot be counted as a
  failing SUT result.
- A verdict cannot overwrite an earlier verdict.
- Bumble logs are required only for the Bumble-backed route.

The next integration slice will stream serial, Appium, logcat, and Bumble logs
into the active run, add checkpoint screenshots/UI hierarchies, and measure the
two latency domains used for timeout calibration.

## Schemas

The JSON Schema files in `schemas/` define the version-1 contracts. The current
store performs core invariant checks without an external validation package.
Schema validation can be added to the collection-completeness gate without
changing the stored representation.
