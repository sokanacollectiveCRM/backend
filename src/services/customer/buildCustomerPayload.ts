export interface BuildCustomerPayloadResult {
  fullName: string;
  payload: {
    GivenName: string;
    FamilyName: string;
    DisplayName: string;
    PrimaryEmailAddr: { Address: string };
  };
}

export default function buildCustomerPayload(
  firstName: string,
  lastName: string,
  email: string
): BuildCustomerPayloadResult {
  const fullName = `${firstName} ${lastName}`;
  return {
    fullName,
    payload: {
      GivenName: firstName,
      FamilyName: lastName,
      DisplayName: fullName,
      PrimaryEmailAddr: { Address: email }
    }
  };
}
