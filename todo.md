# todo

database

- [x] postgresql database
- [x] it has one users table
  - username
  - email
  - firstname
  - lastname
- [x] deployed using supabase

api

- [x] node express, using supabase ORM
- [x] provide endpoint: get all users
  - requires session token

authentication

- [x] integrate supabase auth
- [x] provide endpoint: login
- [x] provide endpoint: sign up
- [x] provide endpoint: logout (remove session token)
  - requires session token
- [x] oath with google
- [x] allow users to reset passwords organization

- [x] write README.md

code styling

- [x] all the same prettier/eslint configs as frontend

github

- [x] enforce linting/styling in order to merge into main
- [x] can't push directly to main (except ethan, amy, aanand)
- [x] pr templates

deploy

- [x] deploy on vercel
