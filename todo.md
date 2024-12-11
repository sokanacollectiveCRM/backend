# todo

database
- [ ] postgresql database 
- [ ] it has one users table
  - username
  - email
  - firstname
  - lastname
- [ ] deployed using supabase

api 
- [ ] node express, using supabase ORM
- [ ] provide endpoint: get all users
  - requires session token

authentication
- [ ] integrate supabase auth
- [ ] provide endpoint: login
- [ ] provide endpoint: sign up
- [ ] provide endpoint: logout (remove session token)
  - requires session token
- [ ] oath with google

organization
- [ ] write README.md

code styling
- all the same prettier/eslint configs as frontend

github
- enforce linting/styling in order to merge into main
- can't push directly to main (except ethan, amy, aanand)
- pr templates