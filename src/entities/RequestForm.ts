import { IncomeLevel, Pronouns, ServiceTypes, Sex } from "types";

export class RequestForm{
  
  constructor(
    public first_name: string, 
    public last_name: string, 
    public email: string, 
    public phone_number: string, 
    public children_expected: string, 
    public service_needed: ServiceTypes, 
    public pronouns: Pronouns, 
    public address: string, 
    public city: string, 
    public state: string, 
    public zip_code: string, 
    public health_history: string, 
    public allergies: string, 
    public due_date: Date, 
    public hospital: string, 
    public baby_sex: Sex, 
    public annual_income: IncomeLevel,
    public service_specifics: string, 
  ) {}
}