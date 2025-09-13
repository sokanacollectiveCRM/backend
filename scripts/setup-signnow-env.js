// Set up SignNow environment variables
process.env.SIGNNOW_ENV = 'eval';
process.env.SIGNNOW_BASE_URL = 'https://api-eval.signnow.com';
process.env.SIGNNOW_API_TOKEN = '42d2a44df392aa3418c4e4486316dd2429b27e7b690834c68cd0e407144';
process.env.SIGNNOW_CLIENT_ID = '323e680065f1cbee4fe1e97664407a0b';
process.env.SIGNNOW_CLIENT_SECRET = '5b2cbddac384f40fa1043ed19b34c61a';
process.env.SIGNNOW_USERNAME = 'jerry@techluminateacademy.com';
process.env.SIGNNOW_PASSWORD = '@Bony5690';

// Run the test script
require('./test-signnow.js');


