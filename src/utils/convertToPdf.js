'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = convertToPdf;
const cloudconvert_1 = __importDefault(require('cloudconvert'));
async function convertToPdf(docxBuffer) {
  const cloudConvert = new cloudconvert_1.default(
    process.env.CLOUDCONVERT_API_KEY
  );
  try {
    const job = await cloudConvert.jobs.create({
      tasks: {
        upload: {
          operation: 'import/upload',
        },
        convert: {
          operation: 'convert',
          input: 'upload',
          input_format: 'docx',
          output_format: 'pdf',
          engine: 'libreoffice',
        },
        export: {
          operation: 'export/url',
          input: 'convert',
        },
      },
    });
    const uploadTask = job.tasks.find((t) => t.name === 'upload');
    if (!uploadTask) throw new Error('Upload task not found');
    await cloudConvert.tasks.upload(
      uploadTask,
      docxBuffer,
      'contract.docx',
      docxBuffer.length
    );
    const completedJob = await cloudConvert.jobs.wait(job.id);
    const exportTask = completedJob.tasks.find(
      (t) => t.name === 'export' && t.status === 'finished'
    );
    if (!exportTask?.result?.files?.[0]?.url) {
      throw new Error('Export task failed or URL missing');
    }
    const pdfUrl = exportTask.result.files[0].url;
    const pdfRes = await fetch(pdfUrl);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    return pdfBuffer;
  } catch (err) {
    console.error('Job creation error:', err.message);
    console.error(err.response?.data || err);
    throw err;
  }
}
