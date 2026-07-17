import { getAccessToken, qboRequest } from '../../utils/qboClient';

export interface QuickBooksCompanyInfo {
  name: string;
  legalName: string | null;
  email: string | null;
  country: string | null;
}
export async function getQuickBooksCompanyInfo(): Promise<QuickBooksCompanyInfo | null> {
  const { realmId } = await getAccessToken();
  const response = await qboRequest<{
    CompanyInfo?: {
      CompanyName?: string;
      LegalName?: string;
      Country?: string;
      Email?: { Address?: string };
    };
  }>(`/companyinfo/${encodeURIComponent(realmId)}?minorversion=65`);
  const company = response.CompanyInfo;
  if (!company?.CompanyName) return null;

  return {
    name: company.CompanyName,
    legalName: company.LegalName || null,
    email: company.Email?.Address || null,
    country: company.Country || null,
  };
}
