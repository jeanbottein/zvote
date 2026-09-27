#!/bin/bash
# build.sh <name> <jdk home> <maven arguments...>
# Builds a copy of the server in target/perf/<name>, so that several builds (a jar, a jar with
# Spring AOT, native images) can sit side by side.
set -euo pipefail
SERVER=$(cd "$(dirname "$0")/.." && pwd)
NAME=$1; JDK=$2; shift 2
mkdir -p "$SERVER/target/perf/$NAME"
rsync -a --delete --exclude target "$SERVER/" "$SERVER/target/perf/$NAME/"
cd "$SERVER/target/perf/$NAME" && JAVA_HOME="$JDK" PATH="$JDK/bin:$PATH" ./mvnw "$@"
