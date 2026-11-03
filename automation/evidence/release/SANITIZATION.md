# Sanitization and inclusion policy

The package is generated from the private pilot workspace; source evidence is
never edited in place.

## Preserved without transformation

- all available `manifest.json`, `events.jsonl`, `capture.json`, and
  `verdict.json` files for the 88 confirmatory attempts;
- study order, timestamps, conditions, routes, outcomes, invalidity reasons,
  and measured durations;
- the committed portable freeze record, protocol plan, disposition record,
  aggregate summaries, integrity-audit report, and manuscript-facing data;
- the exact frozen APK and the three firmware binaries declared by the freeze
  record; and
- representative screenshots.

The builder compares SHA-256 identities for every copied normalized run record
and writes the result to `structured-equivalence.json`.

## Transformed representative traces

Only selected representative text traces are published. The deterministic
transform removes ANSI terminal controls and replaces:

- repository, user-home, Android SDK, local-application-data, and AVD paths;
- host names and physical or ephemeral device identifiers;
- the physical serial-port name;
- Bluetooth addresses other than the all-zero protocol sentinel; and
- incidental nearby Bluetooth device names.

The SeamScope peripheral name is retained because it identifies the fictional
fixture. Replacement counts are recorded by file in
`sanitization-report.json`.

## Deliberately omitted

- calibration and dry-run directories;
- the private canonical freeze metadata containing machine paths and device
  serials;
- unrelated nearby Bluetooth advertisements in identifiable form;
- most verbose Appium, Logcat, and Bumble session logs;
- firmware ELF and map products not declared by the portable freeze record;
  and
- personal or machine-specific paths and unique hardware serial numbers.

These exclusions reduce privacy and disclosure risk without changing the
normalized evidence used for the reported result. The private originals remain
available to the author for provenance checks.

