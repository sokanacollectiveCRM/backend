import unittest

from isolatedCloudRunEnv import build_pairs, plain_env, to_gcloud_env


class IsolatedCloudRunEnvTest(unittest.TestCase):
    def test_enables_live_email_qbo_and_stripe(self):
        plain = plain_env(
            [
                {'name': 'EMAIL_USER', 'value': 'hello@sokanacollective.com'},
                {'name': 'QB_CLIENT_ID', 'value': 'qb-client'},
                {'name': 'QB_CLIENT_SECRET', 'value': 'qb-secret'},
                {'name': 'STRIPE_SECRET_KEY', 'value': 'sk_live_example'},
                {'name': 'FRONTEND_ORIGIN', 'value': 'https://production.example'},
            ]
        )
        pairs = dict(
            build_pairs(
                plain,
                {
                    'cloud_sql_host': '/cloudsql/proj:us-central1:sokana-phi-postgres-dev',
                    'database': 'sokana_private_dev',
                    'db_user': 'app_user',
                    'connection': 'proj:us-central1:sokana-phi-postgres-dev',
                    'project_id': 'sokana-private-data',
                    'cors': 'https://sokana-front-end-dev.example,http://localhost:3001',
                    'frontend_url': 'https://sokana-front-end-dev.example',
                    'signing_url': 'https://sokana-front-end-dev.example/signing',
                    'qb_redirect_uri': 'https://sokana-private-api-dev.example/quickbooks/callback',
                },
            )
        )
        self.assertEqual(pairs['FEATURE_EMAIL'], 'true')
        self.assertEqual(pairs['FEATURE_QUICKBOOKS'], 'true')
        self.assertEqual(pairs['FEATURE_STRIPE'], 'true')
        self.assertEqual(pairs['EMAIL_USER'], 'hello@sokanacollective.com')
        self.assertEqual(
            pairs['QB_REDIRECT_URI'],
            'https://sokana-private-api-dev.example/quickbooks/callback',
        )
        self.assertIn('sokana-front-end-dev.example', pairs['FRONTEND_ORIGIN'])
        self.assertNotIn('production.example', pairs['FRONTEND_ORIGIN'])
        self.assertEqual(pairs['CLOUD_SQL_DATABASE'], 'sokana_private_dev')
        self.assertEqual(pairs['TENANCY_ENFORCE'], 'on')
        encoded = to_gcloud_env(list(pairs.items()))
        self.assertTrue(encoded.startswith('^|^'))
        self.assertIn('FEATURE_QUICKBOOKS=true', encoded)

    def test_reads_gcloud_nested_service_json(self):
        payload = {
            'spec': {
                'template': {
                    'spec': {
                        'containers': [
                            {
                                'env': [
                                    {'name': 'QB_CLIENT_ID', 'value': 'qb-client'},
                                    {'name': 'QB_CLIENT_SECRET', 'value': 'qb-secret'},
                                    {'name': 'STRIPE_SECRET_KEY', 'value': 'sk_live_example'},
                                ]
                            }
                        ]
                    }
                }
            }
        }
        pairs = dict(
            build_pairs(
                plain_env(payload),
                {
                    'cloud_sql_host': '/cloudsql/x',
                    'database': 'sokana_private_dev',
                    'db_user': 'app_user',
                    'connection': 'x',
                    'project_id': 'sokana-private-data',
                    'cors': 'https://front.dev',
                    'frontend_url': 'https://front.dev',
                    'signing_url': 'https://front.dev/signing',
                    'qb_redirect_uri': 'https://api.dev/quickbooks/callback',
                },
            )
        )
        self.assertEqual(pairs['QB_CLIENT_ID'], 'qb-client')
        self.assertEqual(pairs['STRIPE_SECRET_KEY'], 'sk_live_example')


if __name__ == '__main__':
    unittest.main()
