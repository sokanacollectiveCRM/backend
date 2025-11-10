const util = require('util');

function logAxiosError(err, label = 'Axios error') {
  if (err?.isAxiosError) {
    const status = err.response?.status;
    const data = err.response?.data;
    const errors = (data?.errors && Array.isArray(data.errors)) ? data.errors : undefined;

    console.error(`${label}: status=${status}`);
    if (errors) {
      console.error('errors:', util.inspect(errors, { depth: null, colors: true }));
    } else if (data) {
      console.error('data:', util.inspect(data, { depth: null, colors: true }));
    }
    console.error('config.url:', err.config?.url);
    console.error('config.method:', err.config?.method);
    if (err.config?.data) {
      console.error('config.data:', typeof err.config.data === 'string'
        ? err.config.data
        : util.inspect(err.config.data, { depth: null, colors: true }));
    }
  } else {
    console.error(`${label}:`, util.inspect(err, { depth: null, colors: true }));
  }
}

module.exports = { logAxiosError };















