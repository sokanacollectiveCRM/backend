export enum ServiceTypes{
  LABOR_SUPPORT = "Labor Support",
  POSTPARTUM_SUPPORT= "Postpartum Support",
  PERINATAL_EDUCATION= "Perinatal Education",
  FIRST_NIGHT = "First Night Care",
  LACTATION_SUPPORT = "Lactation Support",
  PHOTOGRAPHY = "Photography",
  OTHER = "Other"
}

export enum Pronouns{
  HE_HIM = "he/him",
  SHE_HER = "she/her",
  THEY_THEM = "they/them",
  OTHER = "other",
}

export enum Sex{
  MALE = "Male",
  FEMALE = "Female"
}

export enum IncomeLevel{
  FROM_0_TO_24999 = "$0 - $24,999",
  FROM_25000_TO_44999 = "$25,000 - $44,999",
  FROM_45000_TO_64999 = "$45,000 - $64,999",
  FROM_65000_TO_84999 = "$65,000 - $84,999",
  FROM_85000_TO_99999 = "$85,000 - $99,999",
  ABOVE_100000 = "$100,000 and above"
}

export class RequestForm{
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  children_expected: string;
  service_needed: ServiceTypes;
  pronouns: Pronouns;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  health_history: string;
  allergies: string;
  due_date: Date;
  hospital: string;
  baby_sex: Sex;
  annual_income: IncomeLevel;
  service_specifics: string;
  
  constructor(
    first_name: string, 
    last_name: string, 
    email: string, 
    phone_number: string, 
    children_expected: string, 
    service_needed: ServiceTypes, 
    pronouns: Pronouns, 
    address: string, 
    city: string, 
    state: string, 
    zip_code: string, 
    health_history: string, 
    allergies: string, 
    due_date: Date, 
    hospital: string, 
    baby_sex: Sex, 
    annual_income: IncomeLevel,
    service_specifics: string, 
  ){
    this.first_name = first_name
    this.last_name = last_name
    this.email = email
    this.phone_number = phone_number
    this.children_expected = children_expected
    this.service_needed = service_needed
    this.pronouns = pronouns 
    this.address = address 
    this.city = city 
    this.state = state 
    this.zip_code = zip_code 
    this.health_history = health_history 
    this.allergies = allergies 
    this.due_date = due_date 
    this.hospital = hospital 
    this.baby_sex = baby_sex 
    this.annual_income = annual_income
    this.service_specifics = service_specifics
  }
}