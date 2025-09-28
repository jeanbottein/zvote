cd scripts || exit 1
./build_stbd_module.sh || exit 2
./start_stdb_and_publish_module.sh || exit 4
./build_and_run_client.sh || exit 3