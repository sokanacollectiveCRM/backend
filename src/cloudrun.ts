import app from './server';

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cloud Run listening on ${PORT}`);
});
