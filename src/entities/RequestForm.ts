export enum ServiceTypes{
  LABOR_SUPPORT = "Labor Support",
  POSTPARTUM_SUPPORT= "Postpartum Support",
  PERINATAL_EDUCATION= "Perinatal Education",
  FIRST_NIGHT = "First Night Care",
  LACTATION_SUPPORT = "Lactation Support",
  PHOTOGRAPHY = "Photography",
  OTHER = "Other"

}

export class RequestForm{
  first_name:string; 
  last_name:string;
  email:string;
  phone_number:string;
  children_expected:number;
  service_needed:ServiceTypes;

  constructor(
    first_name: string,
    last_name: string,
    email: string,
    phone_number: string,
    children_expected: number,
    service_needed: ServiceTypes
  ){
    this.first_name = first_name
    this.last_name = last_name
    this.email = email
    this.phone_number = phone_number
    this.children_expected = children_expected
    this.service_needed = service_needed
  }

}
