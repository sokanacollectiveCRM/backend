#!/usr/bin/env bash
set -e
BROKER_URL="https://sokana-phi-broker-634744984887.us-central1.run.app"
SHARED_SECRET="tUmnXddkTCx06TrqPC6onZ7hzMzzR4E1CJn7qbwbPIDjqyV6ZyZ+B/8XIMq//6Qr"
CLIENT_ID="ced55ced-c62c-48c0-81fb-353fe4a99cc4"
USER_ID="528e4d28-b24a-47f1-a66b-d7ddd507b7b9"
ROLE="admin"

BODY=$(printf '{"client_id":"%s","requester":{"role":"%s","user_id":"%s","assigned_client_ids":[]}}' "$CLIENT_ID" "$ROLE" "$USER_ID")
TS=$(python3 -c 'import time; print(int(time.time()*1000))')
export BODY TS SHARED_SECRET
SIG=$(python3 -c '
import hmac, hashlib, os
secret=os.environ["SHARED_SECRET"].encode()
ts=os.environ["TS"]
body=os.environ["BODY"].encode()
print(hmac.new(secret, (ts + ".").encode() + body, hashlib.sha256).hexdigest())
')

curl -sS "$BROKER_URL/v1/phi/client" \
  -H "Content-Type: application/json" \
  -H "X-Sokana-Timestamp: $TS" \
  -H "X-Sokana-Signature: $SIG" \
  -d "$BODY"
