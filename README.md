# RAG Pipeline Eval

A GitHub Action that fails a pull request when your RAG pipeline's answers get less grounded. It runs a test set through your pipeline with [`@devilsdev/rag-pipeline-utils`](https://www.npmjs.com/package/@devilsdev/rag-pipeline-utils), checks the scores against minimums and against your main branch, and posts a summary on the pull request.

It needs `@devilsdev/rag-pipeline-utils` 2.7.0 or later, which adds the `rag-pipeline eval` command. When your project doesn't have the library installed, the Action installs the latest 2.x.

## What it checks

Each question in your test set runs through the pipeline in your `.ragrc.json`. The Action scores the answers:

| Metric             | What it measures                                                         |
| ------------------ | ------------------------------------------------------------------------ |
| `faithfulness`     | Share of the answer's sentences supported by the retrieved passages      |
| `relevance`        | How well the answer addresses the question                               |
| `contextPrecision` | Share of retrieved passages that support the answer                      |
| `contextRecall`    | How much of your reference answer the passages support (needs `expected`) |
| `groundedness`     | A weighted combination of the above                                      |
| `citationCoverage` | Share of the answer's sentences with a supporting citation               |
| `sourceRecall`     | Share of the expected documents that were retrieved (needs `sourceIds`)  |

The job fails when:

- a question errors;
- a metric's average is below its `min`;
- compared with the baseline, a metric's average dropped by more than `tolerance`, or a question that passed now fails.

## A test set

A JSON array, a `{ "cases": [...] }` object, or a `.jsonl` file with one case per line:

```json
[
  {
    "id": "vacation",
    "prompt": "How many days of paid vacation do full-time employees get?",
    "expected": "Full-time employees receive twenty days of paid vacation per year.",
    "sourceIds": ["docs/vacation.md"]
  }
]
```

Only `prompt` is required. `sourceIds` can name a file; it matches the chunks indexed from it. Give cases stable `id`s, because runs are compared case by case. See the [dataset format](https://devilsdev.github.io/rag-pipeline-utils/docs/Evaluation#dataset-format).

## Usage

### Minimums only

```yaml
name: RAG eval
on: pull_request

permissions:
  contents: read
  pull-requests: write # to post the summary

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: DevilsDev/rag-eval-action@v1
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          ingest: docs
          dataset: eval/tests.json
          min: |
            faithfulness=0.8
            sourceRecall=0.9
```

### Compare with the main branch

With `baseline-cache: true`, a push to your default branch saves its report in the Actions cache, and pull requests are compared with the latest one:

```yaml
name: RAG eval
on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: DevilsDev/rag-eval-action@v1
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        with:
          ingest: docs
          dataset: eval/tests.json
          baseline-cache: true
          min: faithfulness=0.8
```

GitHub evicts a cache entry that goes unused for 7 days. When no baseline is found, on the first pull request or after an eviction, the comparison is skipped and only the minimums apply. The summary says so.

To control the baseline yourself, for example a report committed to the repository or downloaded from another workflow, pass its path as `baseline`. The `report` output is the file to keep.

### If your project depends on the library

When the project has `@devilsdev/rag-pipeline-utils` installed (for example because the config loads your own plugins), install your dependencies before this step. The Action then uses your project's `rag-pipeline`, so the version matches your code. Otherwise it installs `@devilsdev/rag-pipeline-utils@<version>`.

Scoring can change between library versions. When the baseline and the run used different versions, the summary warns you; save a new baseline after upgrading.

## Inputs

| Input               | Default             | Description                                                                                      |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `dataset`           | (required)          | The test set, relative to `working-directory`                                                    |
| `working-directory` | `.`                 | Directory with the config and documents                                                          |
| `config`            | `.ragrc.json`       | Config file                                                                                      |
| `ingest`            |                     | Path to index before the run; leave empty when the index is already there                        |
| `min`               |                     | Minimums, one `metric=value` per line                                                            |
| `baseline`          |                     | A saved report to compare with                                                                   |
| `baseline-cache`    | `false`             | Save the default branch's report in the Actions cache and compare pull requests with it          |
| `tolerance`         | `0.02`              | Allowed drop in a metric's average from the baseline                                             |
| `case-tolerance`    | `0.1`               | Drop in one case's score that lists the case in the summary                                      |
| `concurrency`       | `1`                 | Questions run at the same time; raise it if your provider's rate limits allow                    |
| `timeout`           |                     | Per-question timeout in milliseconds                                                             |
| `top-k`             | `3`                 | Passages to retrieve                                                                             |
| `name`              | `rag-eval`          | Separates the cached baseline and the comment when a workflow runs more than one evaluation      |
| `comment`           | `true`              | Post the summary on the pull request and update it on later runs                                 |
| `fail`              | `true`              | Fail the job when the evaluation fails; `false` only reports                                     |
| `version`           | `2`                 | Library version to install when the project doesn't have it                                      |
| `package`           |                     | A package to install instead, such as a tarball; mostly for testing                              |
| `node-version`      | `22`                | Node.js version to set up; empty uses the runner's                                               |
| `github-token`      | `${{ github.token }}` | Token for the comment                                                                          |

## Outputs

| Output     | Description                                        |
| ---------- | -------------------------------------------------- |
| `passed`   | `"true"` or `"false"`                              |
| `report`   | Path to this run's JSON report, a future baseline  |
| `summary`  | Path to the Markdown summary                       |
| `compared` | `"true"` when the run was compared with a baseline |

## Security

- **Fork pull requests** get a read-only token and no secrets. The summary is still written to the job summary, and the Action logs a warning instead of failing when it can't comment. An evaluation that needs an API key can't run on a fork's pull request.
- **Don't switch to `pull_request_target` to get secrets for forks.** It runs the fork's code with your secrets.
- The Action passes every input to its scripts through environment variables, never by expanding them into the script, and pins the actions it uses to commit SHAs.
- Model answers vary between runs. Run your configuration a few times to see how far the scores move, and keep `tolerance` above that, so that noise doesn't fail pull requests.

## License

MIT
