import { PortalEligibilityDeps } from './application/ports';
import { CloudSqlOnboardingFactsReader } from './infrastructure/cloudSqlOnboardingFactsReader';
import { CloudSqlPortalReadinessStore } from './infrastructure/cloudSqlPortalReadinessStore';
import { QuickBooksCardOnFileReader } from './infrastructure/quickBooksCardOnFileReader';

export function createPortalEligibilityDeps(): PortalEligibilityDeps {
  return {
    facts: new CloudSqlOnboardingFactsReader(),
    cards: new QuickBooksCardOnFileReader(),
    readiness: new CloudSqlPortalReadinessStore(),
  };
}
