#!/usr/bin/env python3
"""Build isolated Cloud Run env from production env JSON plus isolated overrides.

Prints a gcloud ^|^ env string to stdout. Prints copied key names (not values)
to stderr. Never logs secret values.
"""

from __future__ import annotations

import json
import sys


COPY_FROM_PROD = [
    'AUTH_PROVIDER',
    'IDENTITY_PLATFORM_PROJECT_ID',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'GCS_DOCUMENTS_BUCKET',
    'NATIVE_CONTRACTS_ENABLED',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_SECURE',
    'EMAIL_USER',
    'EMAIL_FROM',
    'QB_CLIENT_ID',
    'QB_CLIENT_SECRET',
    'QB_WEBHOOK_VERIFIER_TOKEN',
    'INTUIT_WEBHOOK_VERIFIER_TOKEN',
    'QBO_ENV',
    'QUICKBOOKS_ENVIRONMENT',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
]

DEFAULTS = {
    'AUTH_PROVIDER': 'dual',
    'GCS_DOCUMENTS_BUCKET': 'sokana-private-documents',
    'NATIVE_CONTRACTS_ENABLED': 'true',
    'EMAIL_HOST': 'smtp.gmail.com',
    'EMAIL_PORT': '465',
    'EMAIL_SECURE': 'true',
    'EMAIL_USER': 'hello@sokanacollective.com',
    'EMAIL_FROM': 'Sokana CRM <hello@sokanacollective.com>',
    'QBO_ENV': 'production',
    'QUICKBOOKS_ENVIRONMENT': 'production',
}


def env_items(payload: object) -> list:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    if isinstance(payload.get('env'), list):
        return payload['env']
    try:
        containers = payload['spec']['template']['spec']['containers']
        return containers[0].get('env') or []
    except (KeyError, IndexError, TypeError):
        return []


def plain_env(payload: object) -> dict[str, str]:
    out: dict[str, str] = {}
    for item in env_items(payload):
        if item.get('name') and 'value' in item:
            out[item['name']] = item['value']
    return out


def grab(plain: dict[str, str], name: str) -> str:
    value = str(plain.get(name) or '').strip()
    if value:
        return value
    return DEFAULTS.get(name, '')


def build_pairs(plain: dict[str, str], isolated: dict[str, str]) -> list[tuple[str, str]]:
    copied = {name: grab(plain, name) for name in COPY_FROM_PROD}
    pairs = [
        ('CLOUD_SQL_HOST', isolated['cloud_sql_host']),
        ('CLOUD_SQL_PORT', '5432'),
        ('CLOUD_SQL_DATABASE', isolated['database']),
        ('CLOUD_SQL_USER', isolated['db_user']),
        ('CLOUD_SQL_SSLMODE', 'disable'),
        ('DB_INSTANCE_CONNECTION_NAME', isolated['connection']),
        ('DB_NAME', isolated['database']),
        ('DB_USER', isolated['db_user']),
        ('NODE_ENV', 'production'),
        ('TENANCY_ENFORCE', 'on'),
        ('SPLIT_DB_READ_MODE', 'primary'),
        ('GOOGLE_CLOUD_QUOTA_PROJECT', isolated['project_id']),
        ('GCLOUD_PROJECT', isolated['project_id']),
        ('GOOGLE_CLOUD_PROJECT', isolated['project_id']),
        ('FRONTEND_ORIGIN', isolated['cors']),
        ('FRONTEND_URL', isolated['frontend_url']),
        ('CONTRACT_SIGNING_BASE_URL', isolated['signing_url']),
        ('FEATURE_STRIPE', 'true'),
        ('FEATURE_QUICKBOOKS', 'true'),
        ('FEATURE_EMAIL', 'true'),
        ('QB_REDIRECT_URI', isolated['qb_redirect_uri']),
        *copied.items(),
        ('IDENTITY_PLATFORM_PROJECT_ID', grab(plain, 'IDENTITY_PLATFORM_PROJECT_ID') or isolated['project_id']),
        ('NOTIFICATION_TICK_AUDIENCE', isolated.get('notification_tick_audience', '')),
        ('NOTIFICATION_TICK_EMAIL', isolated.get('notification_tick_email', '')),
    ]
    # Later duplicates win; keep first-occurrence order with last value.
    merged: dict[str, str] = {}
    for key, value in pairs:
        merged[key] = value
    return [(key, value) for key, value in merged.items() if value != '']


def to_gcloud_env(pairs: list[tuple[str, str]]) -> str:
    return '^|^' + '|'.join(f'{key}={value}' for key, value in pairs)


def main() -> None:
    payload = json.load(sys.stdin)
    isolated = json.loads(sys.argv[1])
    pairs = build_pairs(plain_env(payload), isolated)
    print('Isolated Cloud Run env keys: ' + ', '.join(key for key, _ in pairs), file=sys.stderr)
    print(to_gcloud_env(pairs))


if __name__ == '__main__':
    main()
