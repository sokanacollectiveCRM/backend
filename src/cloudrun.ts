import app from './server';

const port = Number(process.env.PORT ?? 8080);

app.listen(port, () => {
  console.log(`Cloud Run listening on ${port}`);
});
