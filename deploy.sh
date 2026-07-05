#!/bin/bash

cd /opt/nukhba_alawael_backend || exit

git pull origin main

docker compose down
docker compose up -d --build