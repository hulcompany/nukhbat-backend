#!/bin/bash

cd /opt/nukhbat-backend || exit

git pull origin main

docker compose down
docker compose up -d --build