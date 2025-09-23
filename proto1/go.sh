./build_db_module.sh || exit 1
sleep 2
./build_client.sh || exit 2
sleep 2
./start_and_publish_db.sh || exit 3
sleep 2
./run_client_preview.sh || exit 4
sleep 2
