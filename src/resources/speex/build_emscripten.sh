#!/usr/bin/env bash
set -eo pipefail

emcc \
  -s INITIAL_MEMORY=20MB \
  -s ALLOW_MEMORY_GROWTH=1 \
  -O3 -o src/speex_wasm.js \
  -s EXPORT_ES6=1 \
  -s MODULARIZE=1 \
  -s SINGLE_FILE=1 \
  -s EXPORT_NAME="Speex" \
  -s NO_DYNAMIC_EXECUTION=1 \
  -s USE_ES6_IMPORT_META=0 \
  -s FILESYSTEM=0 \
  -s ASSERTIONS=0 \
  -s EXPORTED_RUNTIME_METHODS="['setValue', 'getValue', 'AsciiToString']" \
  -s ENVIRONMENT=node,web \
  -D FLOATING_POINT=true \
  -D OUTSIDE_SPEEX=true \
  -s EXPORTED_FUNCTIONS="['_malloc', '_free', '_speex_resampler_destroy','_speex_resampler_init','_speex_resampler_get_rate','_speex_resampler_process_interleaved_int','_speex_resampler_strerror']" \
  --llvm-lto 1 \
  ./c/resample.c
