# Feasibility Studio versioning and provenance

## Version tracks

Feasibility artifacts use independent identifiers because a code release, saved-data change, engineering-method change, default-assumption update, and report-layout change have different consequences.

| Track | Current | Covers |
| --- | --- | --- |
| Application | package version | UtilityCalc release containing the feature |
| Project schema | `1.0.0` | Structure of versioned project JSON documents |
| Calculation engine | `1.0.0` | Energy balance, financial equations, validation, and sensitivity behavior |
| Assumption set | `2026.10.0` | Default engineering values and their references |
| Report template | `1.0.0` | Report sections, tables, terminology, and disclosures |

Cloudflare Pages builds also expose `CF_PAGES_COMMIT_SHA` as the report build reference. GitHub builds use `GITHUB_SHA`. A local build reports `local-build` unless `NEXT_PUBLIC_BUILD_COMMIT_SHA` is supplied.

## Artifact contract

Printed reports, supporting CSV files, and project JSON exports record:

- all version-track identifiers;
- build commit when available;
- generation timestamp;
- calculation mode;
- source-record and confirmed-record counts;
- deterministic input fingerprint.

The project JSON additionally contains facility/project context, source-traceable utility records, all scenario inputs, the recommendation, and structured assumption references. It is downloaded locally and is not uploaded by UtilityCalc. Because it can contain customer information, it must be handled as a sensitive project file and must never be committed to the public repository.

## Input fingerprint

`createInputFingerprint` canonicalizes project context, source records, calculation inputs, recommendation, and relevant version identifiers. Transient in-browser record IDs, array ordering, and generation time do not change the fingerprint. Engineering or customer-data changes do.

The `UCFS-XXXXXXXX` value is an FNV-1a reproducibility checksum. It is designed for comparison and audit lookup, not authentication, digital signing, or tamper evidence.

## Change rules

- Increment the project schema before changing exported JSON structure or interpretation. Add a tested migration before accepting an older schema.
- Increment the calculation engine whenever equations, boundary conditions, validation, or financial behavior changes. Update independent benchmark tests and document expected numerical changes.
- Increment the assumption set whenever a default value, source, source revision, or applicability statement changes.
- Increment the report template whenever report content, terminology, disclosures, or presentation structure changes.
- Increment the application version through `package.json` under the normal release process.
- Never reuse a version identifier for different behavior.

Version constants and structured assumption references live in `lib/feasibility-version.ts`. Numerical defaults used by calculations remain in the domain modules; tests should fail if the versioned reference catalog and implemented defaults diverge.
