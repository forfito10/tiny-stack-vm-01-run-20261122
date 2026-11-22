# TinyStack VM

A Node.js entry for `tiny-stack-vm-01-run-20261122`. It interprets each `program.bin` using the TinyStack ISA and
writes the program's output bytes and exit code.

Run with Node.js 22.18 or newer:

```sh
node main.ts
```

By default, inputs are read from `/input` and results are written under `/output`. To run the kit practice cases
locally, set `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR`, for example:

```sh
MAKEFUN_INPUT_DIR=practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Each input case directory must contain `program.bin` and `input.bin`. The VM writes `stdout.bin` and `exit.txt`
inside the matching output directory. The repository is licensed under the MIT License; see [LICENSE](LICENSE).
