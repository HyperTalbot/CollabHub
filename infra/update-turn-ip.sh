#!/bin/bash
ENV_FILE="/home/yaroslav/Projects/CollabHub/infra/.env"
NEW_IP=$(curl -4 -s --max-time 10 ifconfig.me)
OLD_IP=$(grep '^TURN_EXTERNAL_IP=' "$ENV_FILE" | cut -d= -f2)
if [ -n "$NEW_IP" ] && [ "$NEW_IP" != "$OLD_IP" ]; then
  sed -i "s/^TURN_EXTERNAL_IP=.*/TURN_EXTERNAL_IP=$NEW_IP/" "$ENV_FILE"
  cd /home/yaroslav/Projects/CollabHub
  docker compose -f infra/docker-compose.yml up -d --force-recreate coturn
  echo "$(date): TURN IP $OLD_IP -> $NEW_IP" >> /home/yaroslav/turn-ip.log
fi