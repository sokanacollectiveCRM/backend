"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestForm = void 0;
class RequestForm {
    constructor(
    // Step 1: Client Details (Required)
    firstname, lastname, email, phone_number, service_needed, 
    // Step 2: Home Details (Required)
    address, city, state, zip_code, 
    // Step 1: Client Details (Optional)
    pronouns, pronouns_other, children_expected, 
    // Step 2: Home Details (Optional)
    home_phone, home_type, home_access, pets, 
    // Step 3: Family Members
    relationship_status, first_name, last_name, middle_name, mobile_phone, work_phone, 
    // Step 4: Referral
    referral_source, referral_name, referral_email, 
    // Step 5: Health History
    health_history, allergies, health_notes, 
    // Step 6: Payment Info (Optional)
    annual_income, service_specifics, 
    // Step 7: Pregnancy/Baby
    due_date, birth_location, birth_hospital, number_of_babies, baby_name, provider_type, pregnancy_number, hospital, baby_sex, 
    // Step 8: Past Pregnancies
    had_previous_pregnancies, previous_pregnancies_count, living_children_count, past_pregnancy_experience, 
    // Step 9: Services Interested
    services_interested, service_support_details, 
    // Step 10: Client Demographics (Optional)
    race_ethnicity, primary_language, client_age_range, insurance, demographics_multi) {
        this.firstname = firstname;
        this.lastname = lastname;
        this.email = email;
        this.phone_number = phone_number;
        this.service_needed = service_needed;
        this.address = address;
        this.city = city;
        this.state = state;
        this.zip_code = zip_code;
        this.pronouns = pronouns;
        this.pronouns_other = pronouns_other;
        this.children_expected = children_expected;
        this.home_phone = home_phone;
        this.home_type = home_type;
        this.home_access = home_access;
        this.pets = pets;
        this.relationship_status = relationship_status;
        this.first_name = first_name;
        this.last_name = last_name;
        this.middle_name = middle_name;
        this.mobile_phone = mobile_phone;
        this.work_phone = work_phone;
        this.referral_source = referral_source;
        this.referral_name = referral_name;
        this.referral_email = referral_email;
        this.health_history = health_history;
        this.allergies = allergies;
        this.health_notes = health_notes;
        this.annual_income = annual_income;
        this.service_specifics = service_specifics;
        this.due_date = due_date;
        this.birth_location = birth_location;
        this.birth_hospital = birth_hospital;
        this.number_of_babies = number_of_babies;
        this.baby_name = baby_name;
        this.provider_type = provider_type;
        this.pregnancy_number = pregnancy_number;
        this.hospital = hospital;
        this.baby_sex = baby_sex;
        this.had_previous_pregnancies = had_previous_pregnancies;
        this.previous_pregnancies_count = previous_pregnancies_count;
        this.living_children_count = living_children_count;
        this.past_pregnancy_experience = past_pregnancy_experience;
        this.services_interested = services_interested;
        this.service_support_details = service_support_details;
        this.race_ethnicity = race_ethnicity;
        this.primary_language = primary_language;
        this.client_age_range = client_age_range;
        this.insurance = insurance;
        this.demographics_multi = demographics_multi;
    }
}
exports.RequestForm = RequestForm;
