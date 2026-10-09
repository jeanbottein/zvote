#!/usr/bin/env python3
"""Benchmarks the zvote server built several ways (docs/PERFORMANCE.md has the results).

    perf/bench.py prepare [--pgo]    builds every variant; native images take minutes each
    perf/bench.py run [variant...]   measures them: one JSON line each in target/perf/results.jsonl

JAVA_HOME is a Java 25 JDK, GRAALVM_HOME an Oracle GraalVM for Java 25. Everything is written
under target/perf. The server listens on port 18080, with a database of its own per variant.
"""
import json
import os
import shutil
import signal
import statistics
import subprocess
import sys
import time
import urllib.request

SERVER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERF = os.path.join(SERVER, 'perf')
WORK = os.path.join(SERVER, 'target', 'perf')
JDK = os.environ.get('JAVA_HOME', '')
GRAAL = os.environ.get('GRAALVM_HOME', '')
JAR = 'target/zvote-server-0.1.0-SNAPSHOT.jar'
PORT = 18080
BASE = f'http://127.0.0.1:{PORT}'
LOAD = ['200', '3000', '32', '5']  # viewers, ballots, ballots in flight, rounds
RESTARTS = 5

VARIANTS = {
    'jvm': lambda: [f'{JDK}/bin/java', '-jar', f'{WORK}/jvm/{JAR}'],
    'jvm-compact-headers': lambda: [f'{JDK}/bin/java', '-XX:+UseCompactObjectHeaders', '-jar', f'{WORK}/jvm/{JAR}'],
    'jvm-leyden': lambda: [f'{JDK}/bin/java', f'-XX:AOTCache={WORK}/leyden.aot', '-jar',
                           f'{WORK}/jvm-extracted/zvote-server-0.1.0-SNAPSHOT.jar'],
    'jvm-leyden-spring-aot': lambda: [f'{JDK}/bin/java', f'-XX:AOTCache={WORK}/leyden-spring-aot.aot',
                                      '-Dspring.aot.enabled=true', '-jar',
                                      f'{WORK}/jvm-aot-extracted/zvote-server-0.1.0-SNAPSHOT.jar'],
    'graal-jit': lambda: [f'{GRAAL}/bin/java', '-jar', f'{WORK}/jvm/{JAR}'],
    'native': lambda: [f'{WORK}/native/target/zvote-server'],
    'native-pgo': lambda: [f'{WORK}/native-pgo/zvote-server'],
}


# --- preparing -------------------------------------------------------------------------------

def build(name, jdk, *maven):
    started = time.perf_counter()
    with open(f'{WORK}/{name}.build.log', 'w') as log:
        subprocess.run([f'{PERF}/build.sh', name, jdk, *maven], check=True, stdout=log, stderr=subprocess.STDOUT)
    print(f'built {name} in {time.perf_counter() - started:.0f} s', flush=True)


def extract(name):
    shutil.rmtree(f'{WORK}/{name}-extracted', ignore_errors=True)
    subprocess.run([f'{JDK}/bin/java', '-Djarmode=tools', '-jar', f'{WORK}/{name}/{JAR}', 'extract',
                    '--destination', f'{WORK}/{name}-extracted'], check=True, stdout=subprocess.DEVNULL)


def train(command, cwd=WORK, rounds='2'):
    """Runs a server under the workload, then stops it: what a training run records is written at exit."""
    data = f'{WORK}/data/training'
    shutil.rmtree(data, ignore_errors=True)
    os.makedirs(data)
    with open(f'{WORK}/logs/training.log', 'a') as log:
        process, _ = start(command, data, log, cwd)
        subprocess.run([f'{JDK}/bin/java', f'{PERF}/Load.java', BASE, *LOAD[:3], rounds], check=True,
                       stdout=subprocess.DEVNULL)
        stop(process)


def native_image_command():
    with open(f'{WORK}/native.build.log') as log:
        line = next(l for l in log if 'Executing:' in l and 'native-image' in l)
    return line.split('Executing: ', 1)[1].split()


def native_image(output, *extra):
    """Reruns the native-image command of the native build, with another output and options."""
    command = native_image_command()
    command[command.index('-o') + 1] = output
    started = time.perf_counter()
    with open(f'{output}.build.log', 'w') as log:
        subprocess.run(command + list(extra), check=True, stdout=log, stderr=subprocess.STDOUT,
                       cwd=os.path.dirname(output))
    print(f'built {os.path.basename(output)} in {time.perf_counter() - started:.0f} s', flush=True)


def prepare(pgo):
    build('jvm', JDK, '-q', 'clean', 'package', '-DskipTests')
    # Spring's AOT-generated bean definitions, on the JVM: the native profile without the native compile.
    build('jvm-aot', JDK, '-q', '-Pnative', '-DskipNativeBuild=true', '-DskipTests', 'clean', 'package')
    build('native', GRAAL, '-Pnative', '-DskipTests', 'clean', 'native:compile')

    # Leyden: the AOT cache reads classes from plain jars only, so Boot's jar is extracted first.
    extract('jvm')
    extract('jvm-aot')
    for variant, cache in (('jvm-leyden', 'leyden.aot'), ('jvm-leyden-spring-aot', 'leyden-spring-aot.aot')):
        command = VARIANTS[variant]()
        command[1] = f'-XX:AOTCacheOutput={WORK}/{cache}'
        train(command)
        print(f'trained {cache}', flush=True)

    if pgo:  # Oracle GraalVM: instrumented image, a profiling run, then the optimized image
        out = f'{WORK}/native-pgo'
        os.makedirs(out, exist_ok=True)
        native_image(f'{out}/zvote-server-instrumented', '--pgo-instrument')
        train([f'{out}/zvote-server-instrumented'], cwd=out, rounds='3')  # writes default.iprof there
        native_image(f'{out}/zvote-server', f'--pgo={out}/default.iprof')


# --- measuring -------------------------------------------------------------------------------

def start(command, data_dir, log, cwd=WORK):
    env = dict(os.environ, ZVOTE_DATA_DIR=data_dir, ZVOTE_VOTER_SECRET='benchmark-only-voter-secret-0123456789')
    t0 = time.perf_counter()
    process = subprocess.Popen(command + [f'--server.port={PORT}'], env=env, cwd=cwd,
                               stdout=log, stderr=subprocess.STDOUT)
    while True:
        try:
            with urllib.request.urlopen(f'{BASE}/actuator/health', timeout=1) as response:
                if response.status == 200:
                    return process, (time.perf_counter() - t0) * 1000
        except OSError:
            pass
        if process.poll() is not None:
            raise RuntimeError(f'the server exited with {process.returncode}')
        if time.perf_counter() - t0 > 60:
            raise RuntimeError('the server did not start in 60 s')
        time.sleep(0.005)


def stop(process):
    process.send_signal(signal.SIGTERM)
    process.wait(timeout=60)


def rss_mb(pid):
    return int(subprocess.check_output(['ps', '-o', 'rss=', '-p', str(pid)]).strip()) / 1024


def cpu_seconds(pid):
    value = subprocess.check_output(['ps', '-o', 'cputime=', '-p', str(pid)], text=True).strip()
    seconds = 0.0
    for part in value.replace('-', ':').split(':'):
        seconds = seconds * 60 + float(part.replace(',', '.'))
    return seconds


def measure(name):
    command = VARIANTS[name]()
    data = f'{WORK}/data/{name}'
    shutil.rmtree(data, ignore_errors=True)
    os.makedirs(data)
    with open(f'{WORK}/logs/{name}.log', 'w') as log:
        process, first_start = start(command, data, log)  # creates and migrates the database
        stop(process)
        startups, idle = [], []
        for _ in range(RESTARTS):
            process, ms = start(command, data, log)
            time.sleep(1)
            startups.append(ms)
            idle.append(rss_mb(process.pid))
            stop(process)

        process, _ = start(command, data, log)
        cpu_before = cpu_seconds(process.pid)
        output = subprocess.check_output([f'{JDK}/bin/java', f'{PERF}/Load.java', BASE, *LOAD], text=True)
        cpu_used = cpu_seconds(process.pid) - cpu_before
        loaded = rss_mb(process.pid)
        stop(process)

    rounds = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
    warm = rounds[1:]
    return {
        'variant': name,
        'firstStartMs': round(first_start),
        'startMs': round(statistics.median(startups)),
        'idleMB': round(statistics.median(idle)),
        'loadedMB': round(loaded),
        'coldBallotsPerSecond': round(rounds[0]['ballotsPerSecond']),
        'warmBallotsPerSecond': round(statistics.median(r['ballotsPerSecond'] for r in warm)),
        'warmP50ms': round(statistics.median(r['p50ms'] for r in warm), 1),
        'warmP99ms': round(statistics.median(r['p99ms'] for r in warm), 1),
        'fanOutMs': round(statistics.median(r['fanOutMs'] for r in warm)),
        'errors': sum(r['errors'] for r in rounds),
        'allViewersUpToDate': all(r['allViewersUpToDate'] for r in rounds),
        'ballotsPerCpuSecond': round(sum(r['ballots'] for r in rounds) / cpu_used) if cpu_used else None,
        'rounds': rounds,
    }


if __name__ == '__main__':
    if not (JDK and GRAAL):
        sys.exit('Set JAVA_HOME to a Java 25 JDK and GRAALVM_HOME to an Oracle GraalVM for Java 25.')
    os.makedirs(f'{WORK}/logs', exist_ok=True)
    command, arguments = (sys.argv[1] if len(sys.argv) > 1 else ''), sys.argv[2:]
    if command == 'prepare':
        prepare(pgo='--pgo' in arguments)
    elif command == 'run':
        for variant in arguments or [v for v in VARIANTS if os.path.exists(VARIANTS[v]()[-1])]:
            result = measure(variant)
            with open(f'{WORK}/results.jsonl', 'a') as out:
                out.write(json.dumps(result) + '\n')
            print(json.dumps({k: v for k, v in result.items() if k != 'rounds'}), flush=True)
    else:
        sys.exit(__doc__)
